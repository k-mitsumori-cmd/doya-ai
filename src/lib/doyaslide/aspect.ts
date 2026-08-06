// ============================================
// ドヤスライド 画像比率の正規化
// ============================================
// gpt-image-2 の横長入力は 3:2（1536x1024）だが、プレゼン用途の最終成果物は
// 16:9（1920x1080）に統一する。
//
// ⚠ 以前は単純な中央クロップ（fit:'cover'）で 16:9 にしていたが、
//   上下から各8%(80px)を必ず削るため、AIがタイトルを上端寄りに描いた回では
//   タイトルの上半分が消えていた（実測: 8枚中4枚でタイトル欠け）。
//   画像生成モデルは「上下8%を空ける」という指示を守りきれないため、
//   指示だけに頼らず「中身を絶対に削らない」正規化に変更した。
//
// 現在の方式（コンテンツ検出型）:
//   1. 背景だけの余白行を上下から検出する
//   2. 16:9 にするために必要な分を、その余白の範囲内だけ削る
//   3. 足りない分は左右に「端の色をそのまま伸ばす」形で足して 16:9 にする
//   → どの回でも文字・図解が切れない（余白が足りなければ削らない）
import sharp from 'sharp'
import type { AspectRatio } from './types'

export const WIDE_OUTPUT_WIDTH = 1920
export const WIDE_OUTPUT_HEIGHT = 1080
const TARGET_RATIO = WIDE_OUTPUT_WIDTH / WIDE_OUTPUT_HEIGHT

export function getAspectSafetyInstruction(aspectRatio?: string): string {
  if (aspectRatio !== 'wide') return ''
  return [
    'FINAL OUTPUT FORMAT: exact 16:9 widescreen presentation slide (the 3:2 canvas is reframed to 16:9 afterwards).',
    'Keep ALL text, charts, logos, page numbers and essential graphics inside the CENTER 84% of the canvas height.',
    'Leave the top 8% and the bottom 8% of the canvas as background only — no text, no lines, no graphics there.',
    'The slide title must NEVER touch or run off the top edge: start it clearly below the top 10% of the canvas, fully inside the frame.',
    'No text may be cut off by any edge of the canvas.',
  ].join(' ')
}

export interface NormalizedSlideImage {
  buffer: Buffer
  base64: string
  mimeType: string
}

/**
 * 上下それぞれ「背景だけの行」が何px続いているかを測る。
 * 行ごとの中央値（＝その行の背景色）から大きく外れた画素が一定割合を超えたら「中身がある行」とみなす。
 * 単色・グラデーション背景は中身なし、文字・図形は中身ありと判定される。
 */
async function measureBlankMargins(input: Buffer, width: number, height: number): Promise<{ top: number; bottom: number }> {
  const SAMPLE_W = 256
  const { data, info } = await sharp(input)
    .resize({ width: SAMPLE_W, fit: 'inside' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const w = info.width
  const h = info.height
  const DEVIATION = 28 // これ以上背景から外れたら「インク」
  const INK_RATIO = 0.01 // 行の1%以上がインクなら中身のある行

  const hasInk = (y: number): boolean => {
    const row: number[] = []
    for (let x = 0; x < w; x++) row.push(data[y * w + x])
    const sorted = [...row].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    let ink = 0
    for (const v of row) if (Math.abs(v - median) > DEVIATION) ink++
    return ink > w * INK_RATIO
  }

  let topRows = 0
  while (topRows < h && !hasInk(topRows)) topRows++
  let bottomRows = 0
  while (bottomRows < h - topRows && !hasInk(h - 1 - bottomRows)) bottomRows++

  // 縮小画像の行数を元の解像度に戻す
  const scale = height / h
  return { top: Math.floor(topRows * scale), bottom: Math.floor(bottomRows * scale) }
}

export async function normalizeGeneratedSlide(
  base64: string,
  mimeType: string,
  aspectRatio: AspectRatio | string
): Promise<NormalizedSlideImage> {
  const input = Buffer.from(base64, 'base64')
  if (aspectRatio !== 'wide') {
    return { buffer: input, base64, mimeType }
  }

  const toResult = async (pipeline: sharp.Sharp): Promise<NormalizedSlideImage> => {
    const buffer = await pipeline
      .resize(WIDE_OUTPUT_WIDTH, WIDE_OUTPUT_HEIGHT, { fit: 'fill' })
      .png()
      .toBuffer()
    return { buffer, base64: buffer.toString('base64'), mimeType: 'image/png' }
  }

  // 端の色を伸ばして左右に足すだけの安全策（中身を一切削らない）
  // ※ sharp は 1つのパイプライン内では resize → extend の順に適用されるため、
  //   extend の結果を必ずバッファに落としてから resize する（同一チェーンだと 1920 を超える）
  const padOnly = async (width: number, height: number, src: Buffer) => {
    const needW = Math.round(height * TARGET_RATIO)
    const add = Math.max(0, needW - width)
    if (add === 0) return toResult(sharp(src))
    const left = Math.floor(add / 2)
    const extended = await sharp(src)
      .extend({ left, right: add - left, extendWith: 'copy', background: '#ffffff' })
      .png()
      .toBuffer()
    return toResult(sharp(extended))
  }

  try {
    const meta = await sharp(input).metadata()
    const W = meta.width || 0
    const H = meta.height || 0
    if (!W || !H) return padOnly(WIDE_OUTPUT_WIDTH, WIDE_OUTPUT_HEIGHT, input)

    // 16:9 にするために縦をどれだけ削る必要があるか
    const keepH = Math.round(W / TARGET_RATIO)
    const cutTotal = H - keepH
    if (cutTotal <= 0) {
      // すでに16:9より横長 → 縦は削らず左右で調整
      return padOnly(W, H, input)
    }

    const blank = await measureBlankMargins(input, W, H)
    // 文字のすぐ際まで削らないよう、検出した余白から1%分は残す
    const safety = Math.round(H * 0.01)
    const availTop = Math.max(0, blank.top - safety)
    const availBottom = Math.max(0, blank.bottom - safety)
    const avail = availTop + availBottom

    // 余白の範囲内でだけ削る（足りなければ削らずに左右で調整する）
    const cut = Math.min(cutTotal, avail)
    let cutTop = 0
    let cutBottom = 0
    if (cut > 0) {
      cutTop = Math.min(availTop, Math.round((cut * availTop) / avail))
      cutBottom = Math.min(availBottom, cut - cutTop)
      cutTop = Math.min(availTop, cut - cutBottom) // 端数を上に戻す
    }

    const cropped =
      cutTop + cutBottom > 0
        ? await sharp(input)
            .extract({ left: 0, top: cutTop, width: W, height: H - cutTop - cutBottom })
            .png()
            .toBuffer()
        : input

    return padOnly(W, H - cutTop - cutBottom, cropped)
  } catch {
    // 解析に失敗しても「切らない」方を優先（元の中央クロップには戻さない）
    const meta = await sharp(input).metadata().catch(() => null)
    if (meta?.width && meta?.height) return padOnly(meta.width, meta.height, input)
    return toResult(sharp(input))
  }
}
