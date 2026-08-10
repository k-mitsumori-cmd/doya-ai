// ============================================
// ドヤ広告画像AI ロゴ合成
// ============================================
// ⚠️ 本サービスはテキストを画像生成AIに描かせる「フルベイク」方式だが、
//    **ロゴだけは例外として合成を維持する。**
//    ロゴは1pxの狂いも許されないブランド資産であり、画像生成AIには
//    原理的に正確な再現ができない（形状・字間・色が必ず変わる）。
//
// ⚠️ 合成に失敗しても生成物は返す。ロゴが入らないことより、
//    広告画像そのものが出てこない方が困る。
//
// 実装は前身 /adbanner の logo-overlay.ts を引き継いだ。
import sharp from 'sharp'

export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center-top'

export interface LogoConfig {
  pos: LogoPosition
  /** 画像幅に対するロゴ最大幅（%） */
  maxWidthPct: number
  /** 短辺に対する余白（%） */
  paddingPct: number
}

export const DEFAULT_LOGO_CONFIG: LogoConfig = {
  pos: 'bottom-right',
  maxWidthPct: 22,
  paddingPct: 4,
}

export const LOGO_POSITION_LABELS: Record<LogoPosition, string> = {
  'top-left': '左上',
  'top-right': '右上',
  'bottom-left': '左下',
  'bottom-right': '右下',
  'center-top': '上部中央',
}

/** 背景が明るいか（ロゴの下敷きを敷くかの判断に使う） */
async function isRegionLight(base: Buffer, left: number, top: number, w: number, h: number): Promise<boolean> {
  try {
    const stats = await sharp(base)
      .extract({ left, top, width: Math.max(1, w), height: Math.max(1, h) })
      .stats()
    // 各チャンネルの平均から輝度を出す（sRGBの近似係数）
    const [r, g, b] = stats.channels
    const lum = 0.299 * r.mean + 0.587 * g.mean + 0.114 * b.mean
    return lum > 140
  } catch {
    return true
  }
}

/**
 * 生成画像にロゴを合成する。
 * @param base 実寸のPNG
 * @param logo ロゴ画像（PNG推奨）
 */
export async function overlayLogo(
  base: Buffer,
  logo: Buffer,
  w: number,
  h: number,
  cfg: LogoConfig = DEFAULT_LOGO_CONFIG
): Promise<Buffer> {
  try {
    const maxW = Math.max(40, Math.round((w * cfg.maxWidthPct) / 100))
    const pad = Math.round((Math.min(w, h) * cfg.paddingPct) / 100)

    const resized = await sharp(logo).resize({ width: maxW, withoutEnlargement: true }).png().toBuffer()
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
      case 'center-top': left = Math.round((w - lw) / 2); top = pad; break
    }
    left = Math.max(0, Math.min(left, Math.max(0, w - lw)))
    top = Math.max(0, Math.min(top, Math.max(0, h - lh)))

    // ⚠️ 背景が暗いとロゴ（多くは濃色）が沈んで読めなくなる。
    //    暗い場所に置くときだけ白い下敷きを敷く。常に敷くと白背景で四角が浮く。
    const light = await isRegionLight(base, left, top, lw, lh)
    const layers: sharp.OverlayOptions[] = []
    if (!light) {
      const plateW = lw + pad
      const plateH = lh + pad
      const plateLeft = Math.max(0, Math.min(left - Math.round(pad / 2), Math.max(0, w - plateW)))
      const plateTop = Math.max(0, Math.min(top - Math.round(pad / 2), Math.max(0, h - plateH)))
      const plate = await sharp({
        create: {
          width: plateW,
          height: plateH,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 0.86 },
        },
      })
        .png()
        .toBuffer()
      layers.push({ input: plate, left: plateLeft, top: plateTop })
    }
    layers.push({ input: resized, left, top })

    return await sharp(base).composite(layers).png().toBuffer()
  } catch {
    // ロゴが入らなくても広告画像自体は返す
    return base
  }
}
