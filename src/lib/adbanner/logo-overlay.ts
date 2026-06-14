// ============================================
// ドヤ広告バナーAI ロゴ合成（Sharp）
// AIにロゴを描かせず、生成後に実ロゴをセーフゾーンへ高精度で合成する。
// ============================================
import sharp from 'sharp'
import type { LogoConfig } from './types'

/**
 * base 画像（PNG Buffer, w×h）に logo（PNG/任意）を合成して返す。
 * 失敗時は base をそのまま返す（生成自体は止めない）。
 */
export async function overlayLogo(base: Buffer, logo: Buffer, w: number, h: number, cfg: LogoConfig): Promise<Buffer> {
  try {
    const maxW = Math.max(40, Math.round((w * cfg.maxWidthPct) / 100))
    const pad = Math.round((Math.min(w, h) * cfg.paddingPct) / 100)
    const resized = await sharp(logo)
      .resize({ width: maxW, withoutEnlargement: true })
      .png()
      .toBuffer()
    const meta = await sharp(resized).metadata()
    const lw = meta.width || maxW
    const lh = meta.height || maxW
    let left = pad
    let top = pad
    switch (cfg.pos) {
      case 'top-left': left = pad; top = pad; break
      case 'top-right': left = w - lw - pad; top = pad; break
      case 'bottom-left': left = pad; top = h - lh - pad; break
      case 'bottom-right': left = w - lw - pad; top = h - lh - pad; break
      case 'center': left = Math.round((w - lw) / 2); top = pad; break
    }
    left = Math.max(0, Math.min(left, w - lw))
    top = Math.max(0, Math.min(top, h - lh))
    return await sharp(base).composite([{ input: resized, left, top }]).png().toBuffer()
  } catch {
    return base
  }
}
