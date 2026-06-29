// ============================================
// ドヤ広告バナーAI 量産生成オーケストレータ
// gpt-image-2 で生成 → sharp で媒体サイズへリサイズ → ロゴ合成 → Storage保存。
// ============================================
import sharp from 'sharp'
import { generateImageWithFallback } from '@/lib/image-generator'
import { raceTimeout } from '@/lib/fetch-timeout'
import { uploadPng } from './storage'
import { overlayLogo } from './logo-overlay'
import { buildBannerPrompt } from './prompts'
import { findSize, APPEAL_AXES, type AdMedia, type LogoConfig } from './types'

export interface GenerateInput {
  campaignId: string
  serviceName: string
  description?: string
  appeal?: string
  brandColors?: string[]
  media: AdMedia
  sizes: string[]
  variants: number
  logo?: Buffer | null
  logoCfg?: LogoConfig
}

export interface GeneratedCreative {
  imagePath: string
  size: string
  prompt: string
  variantLabel: string
  model: string
}

export function gptSizeFor(w: number, h: number): { size: string; aspect: 'square' | 'landscape' | 'portrait' } {
  if (w === h) return { size: '1024x1024', aspect: 'square' }
  if (w > h) return { size: '1536x1024', aspect: 'landscape' }
  return { size: '1024x1536', aspect: 'portrait' }
}

const TONES = ['信頼感のあるプロフェッショナル', '明るくポップ', 'ミニマルで洗練', '勢いのあるダイナミック']

async function genOne(input: GenerateInput, idx: number): Promise<GeneratedCreative | null> {
  const sizeKey = input.sizes[idx % input.sizes.length]
  const sz = findSize(sizeKey)
  if (!sz) return null
  const axis = APPEAL_AXES[idx % APPEAL_AXES.length]
  const tone = TONES[idx % TONES.length]
  const { size: gptSize, aspect } = gptSizeFor(sz.w, sz.h)

  const prompt = buildBannerPrompt({
    serviceName: input.serviceName,
    description: input.description,
    appeal: input.appeal,
    appealAxis: axis.label,
    tone,
    brandColors: input.brandColors,
    media: input.media,
    aspect,
    hasLogo: !!input.logo,
    logoPos: input.logoCfg?.pos,
  })

  // quality は medium 固定。high + 1536x1024(横長) は実測123〜200秒かかり、下の raceTimeout を超えて
  // 横長バナー(1200x628/728x90)が全滅する。medium なら半分以下の時間で安定生成できる。
  const res = await generateImageWithFallback({ prompt, size: gptSize, quality: 'medium' })
  if (!res?.base64) return null
  const raw = Buffer.from(res.base64, 'base64')
  // 媒体の実寸へリサイズ（cover）
  let buf = await sharp(raw).resize(sz.w, sz.h, { fit: 'cover' }).png().toBuffer()
  // ロゴ合成
  if (input.logo && input.logoCfg) buf = await overlayLogo(buf, input.logo, sz.w, sz.h, input.logoCfg)

  const path = `adbanner/${input.campaignId}/${Date.now()}-${idx}-${sizeKey}.png`
  await uploadPng(path, buf)
  return {
    imagePath: path,
    size: sizeKey,
    prompt,
    variantLabel: `${axis.label}`,
    model: res.model + (res.fallbackUsed ? '(fallback)' : ''),
  }
}

/** N案を量産（同時実行2でVercel 300s内に収める） */
export async function generateBanners(input: GenerateInput): Promise<GeneratedCreative[]> {
  const total = Math.max(1, Math.min(input.variants, 8))
  const out: GeneratedCreative[] = []
  const concurrency = 3 // 8枚でも300s内に収まるよう並行度を上げる（各枚はraceTimeoutで保護）
  let next = 0
  async function worker() {
    while (next < total) {
      const i = next++
      try {
        const c = await raceTimeout('adbannerGen', 150000, genOne(input, i)) // 1枚あたりハードタイムアウト＝ハング防止
        if (c) out.push(c)
      } catch (e) {
        console.error('[adbanner] genOne failed', (e as any)?.message)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker))
  return out
}
