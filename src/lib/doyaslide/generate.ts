// ============================================
// ドヤスライド スライド画像生成ヘルパー（共通）
// ============================================
// generate / regenerate / chat から共通で使う「1スライドをフル画像化 → ロゴ合成」処理。
import { generateImageWithFallback } from '@/lib/image-generator'
import { raceTimeout } from '@/lib/fetch-timeout'
import { ASPECT_TO_SIZE } from './constants'
import { buildImagePrompt } from './prompts'
import { LOGO_POSITION_EN } from './constants'
import { compositeLogo, fetchBuffer } from './logo'
import { uploadSlideImage, uploadComposedImage } from './storage'
import type { AspectRatio, LogoPosition, LogoSize } from './types'

export interface ComposeProject {
  id: string
  aspectRatio: string
  themeColor: string
  stylePreset: string
  docType?: string // 'sns' のときポスター構成に切替（資料テンプレ不使用）
  logoUrl?: string | null
  logoPosition: string
  logoSize: string
  logoBackingChip: boolean
}

export interface ComposeSlide {
  index?: number // 1始まり。あれば本文ページの右下にページ番号として描画
  role?: string | null
  headline?: string | null
  subText?: string | null
  visualPrompt: string
}

export interface ComposeResult {
  rawImageUrl: string
  imageUrl: string
  model: string
  fallbackUsed: boolean
}

/** 1スライドを生成して（ロゴがあれば）合成し、URLを返す */
export async function composeSlideImage(
  userId: string,
  project: ComposeProject,
  slide: ComposeSlide,
  extraInstruction?: string,
  // 修正フロー用: Visionが作った完全プロンプトをそのまま使う（buildImagePromptを通さない）
  promptOverride?: string
): Promise<ComposeResult> {
  const size = ASPECT_TO_SIZE[(project.aspectRatio as AspectRatio)] || ASPECT_TO_SIZE.wide
  const hasLogo = !!project.logoUrl
  const logoPos = (project.logoPosition as LogoPosition) || 'top-right'

  const prompt = promptOverride
    ? [
        promptOverride,
        hasLogo
          ? `IMPORTANT: leave the ${LOGO_POSITION_EN[logoPos] || 'top-right corner'} completely EMPTY — reserve a clean rectangular safe zone for a logo placed later.`
          : '',
        'Absolutely do NOT include any QR code, barcode, or scannable matrix/dot code.',
        'Do NOT invent or display any URL, email, phone number, or social handle that is not already shown in the original.',
        'High quality, professional, visually striking. No watermark. No UI chrome. No borders around the slide.',
      ]
        .filter(Boolean)
        .join('\n')
    : buildImagePrompt({
        slide,
        themeColor: project.themeColor,
        stylePreset: project.stylePreset,
        hasLogo,
        logoPosition: logoPos,
        extraInstruction,
        pageNumber: slide.index,
        docType: project.docType,
      })

  const img = await generateImageWithFallback({ prompt, size, quality: 'high' })

  // I/O は全てタイムアウトで保護（無いと接続滞留でワーカーが無限ブロック→関数強制終了→凍結）
  const UPLOAD_TIMEOUT_MS = Number(process.env.DOYA_UPLOAD_TIMEOUT_MS) || 30000

  // ロゴ合成前の生画像を保存
  const rawImageUrl = await raceTimeout(
    'uploadSlideImage',
    UPLOAD_TIMEOUT_MS,
    uploadSlideImage(userId, project.id, img.base64, img.mimeType)
  )

  let imageUrl = rawImageUrl
  if (hasLogo && project.logoUrl) {
    try {
      const logoBuf = await raceTimeout('fetchLogo', UPLOAD_TIMEOUT_MS, fetchBuffer(project.logoUrl))
      const composed = await compositeLogo(Buffer.from(img.base64, 'base64'), logoBuf, {
        position: (project.logoPosition as LogoPosition) || 'top-right',
        size: (project.logoSize as LogoSize) || 'M',
        backingChip: project.logoBackingChip,
      })
      imageUrl = await raceTimeout('uploadComposedImage', UPLOAD_TIMEOUT_MS, uploadComposedImage(userId, project.id, composed))
    } catch (e) {
      // 合成に失敗してもロゴ無し画像で続行
      console.error('[doyaslide] ロゴ合成失敗:', (e as any)?.message)
      imageUrl = rawImageUrl
    }
  }

  return { rawImageUrl, imageUrl, model: img.model, fallbackUsed: img.fallbackUsed }
}
