// ============================================
// ドヤオープニングAI - カラーユーティリティ
// ============================================

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const h6 = hex.replace('#', '')
  const r = parseInt(h6.slice(0, 2), 16) / 255
  const g = parseInt(h6.slice(2, 4), 16) / 255
  const b = parseInt(h6.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h, s, l }
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n * 255)))
    .toString(16).padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** 色を明るくする (amount: 0-1) */
export function lighten(hex: string, amount: number): string {
  try {
    const { h, s, l } = hexToHSL(hex)
    return hslToHex(h, s, Math.min(1, l + (1 - l) * amount))
  } catch { return hex }
}

/** 色を暗くする (amount: 0-1) */
export function darken(hex: string, amount: number): string {
  try {
    const { h, s, l } = hexToHSL(hex)
    return hslToHex(h, s, l * (1 - amount))
  } catch { return hex }
}

/** 彩度を調整 (factor: >1で鮮やか、<1でくすむ) */
export function saturate(hex: string, factor: number): string {
  try {
    const { h, s, l } = hexToHSL(hex)
    return hslToHex(h, Math.min(1, s * factor), l)
  } catch { return hex }
}

/** 彩度を下げる (amount: 0-1) */
export function desaturate(hex: string, amount: number): string {
  try {
    const { h, s, l } = hexToHSL(hex)
    return hslToHex(h, s * (1 - amount), l)
  } catch { return hex }
}

/** 色相をシフト (degrees: 0-360) */
export function shiftHue(hex: string, degrees: number): string {
  try {
    const { h, s, l } = hexToHSL(hex)
    return hslToHex((h + degrees / 360) % 1, s, l)
  } catch { return hex }
}

/** ゴールド寄りのアクセント色を生成 */
export function toWarmGold(hex: string): string {
  try {
    const { h: _h, s, l } = hexToHSL(hex)
    // ゴールドの色相は約50/360 ≈ 0.139
    return hslToHex(0.139, Math.max(s, 0.7), Math.min(0.55, Math.max(l, 0.45)))
  } catch { return '#D4AF37' }
}
