// ============================================
// ドヤ広告画像AI 生成パイプライン
// ============================================
//   生成サイズで一枚絵を生成（テキスト込み）
//     → 自動検査（OCR照合・混入・セーフエリア）
//     → 不合格なら修正指示を足して再生成（最大2回）
//     → 目標サイズへ「純粋な縮小」だけで書き出し（クロップなし）
//
// ⚠️ 書き出しで絶対に fit:'cover' を使わないこと。
//    前身 /adbanner はこれで 728×90 の縦82%を捨て、見出しもCTAも残らなかった。
//    生成サイズは placements.ts で比率一致するよう事前計算してあるので、
//    ここでの縮小に切り取りは発生しない。
import sharp from 'sharp'
import { generateImageWithFallback } from '@/lib/image-generator'
import { buildImagePrompt } from './prompt'
import { isAcceptable, retryHint, verifyCreative } from './verify'
import { uploadPng } from './storage'
import { overlayLogo, type LogoConfig } from './logo'
import type { CompositionKey, Placement } from './placements'
import type { AdCopy, BrandProfile, VerifyResult } from './types'

/**
 * リトライ上限。
 * ⚠️ 2026-08-31 に 2 → 1 へ。生成が遅いという指摘を受け、待ち時間を優先した。
 *    1枚あたり最大3回だった生成が2回になり、最悪の所要時間がおよそ2/3になる。
 *    代わりに、文字が崩れたまま出る確率は上がる（検査自体は残している）。
 * ⚠️ maxDuration=300 を超えないため、これ以上増やさないこと。
 * medium品質で1枚あたり実測38〜93秒なので、3回目を回すと確実に破綻する。
 */
const MAX_RETRIES = 1

export interface GenerateInput {
  brand: BrandProfile
  copy: AdCopy
  tone: string
  /** 生成サイズを代表する配置（同じ生成サイズの配置はこれを使い回す） */
  placement: Placement
  composition: CompositionKey
  /** refine から渡される構造化改善指示 */
  extraDirectives?: string[]
  /**
   * プロンプトを丸ごと差し替える（利用者が自分で書いた場合）。
   * ⚠️ 指定されたら組み立てを一切行わない。文字の一字一句や禁止事項も
   *    利用者の責任になるため、画面側で「上級者向け」と明示すること。
   */
  customPrompt?: string
  /** 見た目の参考にするテンプレートのプロンプト（作風の文章） */
  designRefPrompt?: string
  /**
   * 見た目の参考にする**画像そのもの**（ドヤバナーAIのテンプレート）。
   * ⚠️ 文章だけでは写真の有無や配置が伝わらず、選んだ見本と全く違う絵になる。
   *    ドヤバナーAI(nanobanner.ts:970)と同じく画像を直接渡す。
   */
  designRefImage?: { mimeType: string; base64: string }
  /** 保存パスの接頭辞 */
  pathPrefix: string
}

export interface GenerateResult {
  /** 生成サイズの原本パス */
  genPath: string
  genSize: string
  prompt: string
  model: string
  verify: VerifyResult
  /** 生成サイズのPNG（実寸書き出しに使い回す） */
  buffer: Buffer
}


/**
 * フォールバック(Gemini)に渡す比率のラベル。
 * ⚠️ これを渡さないと必ず1:1で返り、縦長・横長が作れない
 *    （ドヤバナーAI で実際に起きた。nanobanner.ts:1022 参照）
 */
function aspectLabel(p: Placement): string {
  const r = p.genW / p.genH
  if (r > 1.05) return 'landscape (horizontal)'
  if (r < 0.95) return 'portrait (vertical)'
  return 'square'
}

export async function generateBaked(input: GenerateInput): Promise<GenerateResult> {
  const { brand, copy, tone, placement, composition, extraDirectives = [], pathPrefix, customPrompt, designRefPrompt, designRefImage } = input
  const genSize = `${placement.genW}x${placement.genH}`

  let directives = [...extraDirectives]
  let lastBuffer: Buffer | null = null
  let lastPrompt = ''
  let lastModel = ''
  let lastVerify: VerifyResult = { ocrMatch: false, extraText: [], safeAreaOk: true, retries: 0, needsReview: true }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const prompt = customPrompt?.trim()
      ? customPrompt.trim()
      : buildImagePrompt({
          brand, copy, tone, placement, composition,
          extraDirectives: directives, designRefPrompt,
          hasRefImage: !!designRefImage,
        })
    lastPrompt = prompt

    const result = await generateImageWithFallback({
      prompt,
      size: genSize,
      // ⚠️ medium を既定にする。high は実測93秒かかり、複数案を回すと maxDuration に収まらない。
      //    文字の可読性は medium で十分に確保できている。
      quality: 'medium',
      // ⚠️ 参考画像を渡すと編集APIに切り替わり、受けるサイズが
      //    1024x1024 / 1536x1024 / 1024x1536 の3つに限られる（openai-image.ts:108）。
      //    そのため戻りは目標比率と違いうる。下で必ず比率を揃え直すこと。
      ...(designRefImage ? { inputImages: [designRefImage] } : {}),
      // ⚠️ フォールバック(Gemini)は size を読まない。比率を渡さないと1:1で返る
      //    （nanobanner.ts:1022 と同じ理由）
      ...(designRefImage ? { aspectRatio: aspectLabel(placement) } : {}),
    })
    lastModel = result.fallbackUsed ? `${result.model}(fallback)` : result.model

    const raw = Buffer.from(result.base64, 'base64')
    // 戻りが指定サイズと違うことがあるため、原本の段階で生成サイズへ揃える。
    // ⚠️ **fill を無条件で使ってはいけない。** 比率がほぼ同じときだけ許される。
    //    参照画像を渡すと編集APIの3サイズ（1024x1024 / 1536x1024 / 1024x1536）でしか
    //    返らず、たとえばストーリーズ(9:16)に対して 2:3 が返る。
    //    そこで fill すると縦に引き伸ばされ、顔も文字も歪む。
    // ⚠️ cover も使わない。切り取ると見出しやCTAが欠ける（前身 /adbanner の失敗）。
    //    比率が離れているときは contain で全体を残し、余白は端の色で埋める。
    const meta = await sharp(raw).metadata()
    let buffer: Buffer
    if (meta.width === placement.genW && meta.height === placement.genH) {
      buffer = raw
    } else {
      const srcRatio = (meta.width || 1) / (meta.height || 1)
      const dstRatio = placement.genW / placement.genH
      const ratioDiff = Math.abs(srcRatio - dstRatio) / dstRatio
      if (ratioDiff < 0.05) {
        // 比率がほぼ同じ。引き伸ばしても目に見える歪みは出ない
        buffer = await sharp(raw).resize(placement.genW, placement.genH, { fit: 'fill' }).png().toBuffer()
      } else {
        // 比率が違う。切らずに収め、余白は画像の主要色で埋める（白帯を作らない）
        let bg = { r: 255, g: 255, b: 255, alpha: 1 }
        try {
          const { dominant } = await sharp(raw).stats()
          if (dominant) bg = { r: dominant.r, g: dominant.g, b: dominant.b, alpha: 1 }
        } catch {
          /* 取れなければ白のまま */
        }
        buffer = await sharp(raw)
          .resize(placement.genW, placement.genH, { fit: 'contain', background: bg })
          .png()
          .toBuffer()
      }
    }
    lastBuffer = buffer

    const verify = await verifyCreative({
      pngBase64: buffer.toString('base64'),
      copy,
      composition,
    })
    verify.retries = attempt
    lastVerify = verify

    if (isAcceptable(verify)) break

    if (attempt < MAX_RETRIES) {
      // 修正指示は毎回作り直す（積み上げると意図が薄まる）
      const hint = retryHint(verify, copy)
      directives = hint ? [...extraDirectives, hint] : extraDirectives
    } else {
      // ⚠️ 2回とも不合格でも黙って捨てない。「要確認」を立てて提示する。
      lastVerify.needsReview = true
    }
  }

  if (!lastBuffer) throw new Error('画像を生成できませんでした')

  const genPath = `${pathPrefix}/gen_${genSize}.png`
  await uploadPng(genPath, lastBuffer)

  return { genPath, genSize, prompt: lastPrompt, model: lastModel, verify: lastVerify, buffer: lastBuffer }
}

/**
 * 目標サイズへ書き出す。
 * ⚠️ 純粋な縮小のみ。クロップは行わない。
 *    生成サイズは比率一致するよう事前計算されているため、
 *    比率が完全一致しない 1.91:1 系でも歪みは0.32%に収まる。
 */
export async function exportToSize(
  genBuffer: Buffer,
  placement: Placement,
  pathPrefix: string,
  /** ロゴを載せる場合のみ渡す。⚠️ ロゴは唯一「合成」を維持する要素（lib/adimage/logo.ts） */
  logo?: { buffer: Buffer; config: LogoConfig } | null
): Promise<{ imagePath: string; textAreaPct: number | null }> {
  let out = await sharp(genBuffer)
    .resize(placement.w, placement.h, { fit: 'fill' })
    .png()
    .toBuffer()

  // ⚠️ 縮小したあとに載せる。生成サイズで載せてから縮めるとロゴまで縮んで潰れる。
  if (logo) {
    out = await overlayLogo(out, logo.buffer, placement.w, placement.h, logo.config)
  }

  const imagePath = `${pathPrefix}/${placement.key.replace(/\./g, '_')}_${placement.w}x${placement.h}.png`
  await uploadPng(imagePath, out)

  return { imagePath, textAreaPct: null }
}
