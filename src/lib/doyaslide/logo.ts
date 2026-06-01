// ============================================
// ドヤスライド ロゴ合成 (Sharp)
// ============================================
// 生成画像で空けておいたセーフゾーンに、アップロード済みロゴを最後に合成する。
// AIにロゴを描かせない＝文字化け/崩れを根絶し、全スライドで同じ位置・サイズに統一。
import sharp from 'sharp'
import { LOGO_SIZE_RATIO } from './constants'
import type { LogoPosition, LogoSize } from './types'

export interface LogoCompositeOptions {
  position: LogoPosition
  size: LogoSize
  backingChip: boolean
}

/**
 * baseImage(PNG/JPEG buffer) の指定コーナーに logo(buffer) を合成して PNG buffer を返す
 */
export async function compositeLogo(
  baseImage: Buffer,
  logo: Buffer,
  opts: LogoCompositeOptions
): Promise<Buffer> {
  const base = sharp(baseImage)
  const meta = await base.metadata()
  const W = meta.width || 1536
  const H = meta.height || 1024

  const margin = Math.round(W * 0.035)
  const boxW = Math.round(W * (LOGO_SIZE_RATIO[opts.size] ?? LOGO_SIZE_RATIO.M))
  const boxH = Math.round(boxW * 0.5) // ロゴ枠の高さ（横長想定）

  // ロゴを枠内に収める（アスペクト比維持）
  const resizedLogo = await sharp(logo)
    .resize({ width: boxW, height: boxH, fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()
  const logoMeta = await sharp(resizedLogo).metadata()
  const lw = logoMeta.width || boxW
  const lh = logoMeta.height || boxH

  // 配置座標（コーナー基準）
  const left = computeLeft(opts.position, W, lw, margin)
  const top = computeTop(opts.position, H, lh, margin)

  const layers: sharp.OverlayOptions[] = []

  // 視認性確保のための背景チップ（角丸の半透明白）
  if (opts.backingChip) {
    const pad = Math.round(Math.max(lw, lh) * 0.18)
    const chipW = lw + pad * 2
    const chipH = lh + pad * 2
    const radius = Math.round(Math.min(chipW, chipH) * 0.25)
    const chipSvg = Buffer.from(
      `<svg width="${chipW}" height="${chipH}" xmlns="http://www.w3.org/2000/svg">` +
        `<rect x="0" y="0" width="${chipW}" height="${chipH}" rx="${radius}" ry="${radius}" ` +
        `fill="#ffffff" fill-opacity="0.82"/></svg>`
    )
    layers.push({ input: chipSvg, left: left - pad, top: top - pad })
  }

  layers.push({ input: resizedLogo, left, top })

  return base.composite(layers).png().toBuffer()
}

function computeLeft(position: LogoPosition, W: number, lw: number, margin: number): number {
  if (position.includes('left')) return margin
  if (position.includes('center')) return Math.round((W - lw) / 2)
  // right（既定）
  return W - lw - margin
}

function computeTop(position: LogoPosition, H: number, lh: number, margin: number): number {
  if (position.startsWith('bottom')) return H - lh - margin
  // top（既定）
  return margin
}

// SSRF対策: 取得先は自プロジェクトの Supabase Storage ホストに限定する。
// ロゴ・生画像・スライド画像は全て Supabase バケットに保存されるため、これで十分。
const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host
  } catch {
    return ''
  }
})()

/** URLから画像bufferを取得（Supabase Storage ホストのみ許可・SSRF対策） */
export async function fetchBuffer(url: string): Promise<Buffer> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    throw new Error('不正なURLです')
  }
  if (u.protocol !== 'https:') throw new Error('httpsのURLのみ許可されています')
  if (SUPABASE_HOST && u.host !== SUPABASE_HOST) {
    throw new Error('許可されていないホストです')
  }
  const res = await fetch(url, { redirect: 'error' })
  if (!res.ok) throw new Error(`画像取得失敗: ${res.status}`)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}
