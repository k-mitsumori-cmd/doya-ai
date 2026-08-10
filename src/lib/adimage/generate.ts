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
 * リトライ上限。⚠️ maxDuration=300 を超えないため2回まで。
 * medium品質で1枚あたり実測38〜93秒なので、3回目を回すと確実に破綻する。
 */
const MAX_RETRIES = 2

export interface GenerateInput {
  brand: BrandProfile
  copy: AdCopy
  tone: string
  /** 生成サイズを代表する配置（同じ生成サイズの配置はこれを使い回す） */
  placement: Placement
  composition: CompositionKey
  /** refine から渡される構造化改善指示 */
  extraDirectives?: string[]
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

export async function generateBaked(input: GenerateInput): Promise<GenerateResult> {
  const { brand, copy, tone, placement, composition, extraDirectives = [], pathPrefix } = input
  const genSize = `${placement.genW}x${placement.genH}`

  let directives = [...extraDirectives]
  let lastBuffer: Buffer | null = null
  let lastPrompt = ''
  let lastModel = ''
  let lastVerify: VerifyResult = { ocrMatch: false, extraText: [], safeAreaOk: true, retries: 0, needsReview: true }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const prompt = buildImagePrompt({ brand, copy, tone, placement, composition, extraDirectives: directives })
    lastPrompt = prompt

    const result = await generateImageWithFallback({
      prompt,
      size: genSize,
      // ⚠️ medium を既定にする。high は実測93秒かかり、複数案を回すと maxDuration に収まらない。
      //    文字の可読性は medium で十分に確保できている。
      quality: 'medium',
    })
    lastModel = result.fallbackUsed ? `${result.model}(fallback)` : result.model

    const raw = Buffer.from(result.base64, 'base64')
    // フォールバック先は指定サイズを返さないことがあるため、原本の段階で生成サイズへ揃える。
    // ⚠️ ここも cover ではなく contain + 背景延長にはせず、fill（比率はほぼ同一なので歪みは無視できる）
    const meta = await sharp(raw).metadata()
    const buffer =
      meta.width === placement.genW && meta.height === placement.genH
        ? raw
        : await sharp(raw).resize(placement.genW, placement.genH, { fit: 'fill' }).png().toBuffer()
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
