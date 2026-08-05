// ============================================
// ドヤスライド 画像比率の正規化
// ============================================
// gpt-image-2 の横長入力は 3:2（1536x1024）だが、プレゼン用途の最終成果物は
// 16:9（1920x1080）に統一する。生成時に上下を背景だけのセーフブリードとして空け、
// 生成後に中央クロップすることで、文字や図解を切らずに厳密な16:9へ変換する。
import sharp from 'sharp'
import type { AspectRatio } from './types'

export const WIDE_OUTPUT_WIDTH = 1920
export const WIDE_OUTPUT_HEIGHT = 1080

export function getAspectSafetyInstruction(aspectRatio?: string): string {
  if (aspectRatio !== 'wide') return ''
  return [
    'FINAL OUTPUT FORMAT: exact 16:9 widescreen presentation slide.',
    'The source image canvas is 3:2 and will be center-cropped to 16:9 after generation.',
    'Keep ALL text, faces, charts, logos safe zones, page numbers and essential graphics inside the CENTER 84% of the canvas height.',
    'Leave the top 8% and bottom 8% as background-only bleed with no important content, so the crop never cuts information.',
  ].join(' ')
}

export interface NormalizedSlideImage {
  buffer: Buffer
  base64: string
  mimeType: string
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

  const buffer = await sharp(input)
    .resize(WIDE_OUTPUT_WIDTH, WIDE_OUTPUT_HEIGHT, {
      fit: 'cover',
      position: 'centre',
    })
    .png()
    .toBuffer()

  return {
    buffer,
    base64: buffer.toString('base64'),
    mimeType: 'image/png',
  }
}
