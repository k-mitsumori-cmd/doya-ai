// ============================================
// 面の画像を、面の実寸の縦横比に切り出す（3D の面に切れずに貼るため）
// ============================================
// 仕様: docs/architecture/tenjikai/BOOTH-DESIGN-KIT-2026-10-29.md（6 章）
// - 画像のモデルが作る縦横比は 10 種類だけ（imagegen.ts の RATIOS）。面の実寸の比とは、少しずれる
// - ずれは、中央から切り出して合わせる。切られる量は、先に計算して、指示文の「文字を置く幅」に入れる
// - 3D 側は、切り出し済みの画像を、面の寸法の枠に貼るだけ（object-cover のままで、切れない）
// 計算（cropBox・cutFractions・safeZone）は React・ブラウザを使わない（テストあり: image-fit.test.ts）。
// cropImageToAspect だけがブラウザの canvas を使う。

export const aspectOf = (ratio: string): number => {
  const [a, b] = ratio.split(':').map(Number)
  return a > 0 && b > 0 ? a / b : 1
}

export interface CropBox {
  sx: number
  sy: number
  sw: number
  sh: number
}

/** 画像（幅 × 高さ）の中央から、縦横比（幅 / 高さ）が target の範囲を切り出す */
export function cropBox(imgW: number, imgH: number, target: number): CropBox {
  const cur = imgW / imgH
  if (!(target > 0) || !(cur > 0) || Math.abs(cur - target) < 0.002) return { sx: 0, sy: 0, sw: imgW, sh: imgH }
  if (cur > target) {
    const sw = Math.round(imgH * target)
    return { sx: Math.floor((imgW - sw) / 2), sy: 0, sw, sh: imgH }
  }
  const sh = Math.round(imgW / target)
  return { sx: 0, sy: Math.floor((imgH - sh) / 2), sw: imgW, sh }
}

/** 切り出しで、左右・上下のそれぞれの端から切られる割合（0〜1。片側ぶん） */
export function cutFractions(modelRatio: string, targetAspect: number): { x: number; y: number } {
  const m = aspectOf(modelRatio)
  if (!(targetAspect > 0)) return { x: 0, y: 0 }
  if (m > targetAspect) return { x: (1 - targetAspect / m) / 2, y: 0 }
  if (m < targetAspect) return { x: 0, y: (1 - m / targetAspect) / 2 }
  return { x: 0, y: 0 }
}

/**
 * 切られたあとも見えている範囲（モデルが作る画像に対する割合）を、指示文の「文字を置く幅・高さ」にする。
 * 切られる量が 2% 未満なら 100（制限なし）。
 */
export function safeZone(modelRatio: string, targetAspect: number): { safeWidthPct: number; safeHeightPct: number } {
  const c = cutFractions(modelRatio, targetAspect)
  const w = c.x < 0.01 ? 100 : Math.floor((1 - 2 * c.x) * 100) - 2
  const h = c.y < 0.01 ? 100 : Math.floor((1 - 2 * c.y) * 100) - 2
  return { safeWidthPct: Math.max(30, w), safeHeightPct: Math.max(30, h) }
}

/**
 * 画像の外側に、灰色の額縁（台紙）のような帯が付いていないかを調べ、その幅を返す（割合 0〜0.3。片側ぶん）。
 * 2026-10-29 の試し: 24枚のうち約4割で、モデルが、ポスターを灰色の台紙に載せたような絵を作った。
 * 見本（マスター）に付いていると、見本を参照して作る残りの面にも、そのまま写る。
 * 灰色の帯: 彩度が低く（RGB の差が 16 未満）、明るさが 40〜205。白（紙の色）や、紺の円は、帯とみなさない。
 */
export function grayFrameInset(rgba: Uint8ClampedArray | number[], w: number, h: number): { top: number; right: number; bottom: number; left: number } {
  const isMat = (i: number) => {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2]
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    const lum = (r + g + b) / 3
    return mx - mn < 16 && lum >= 40 && lum <= 205
  }
  const rowMat = (y: number) => { let n = 0; for (let x = 0; x < w; x++) if (isMat((y * w + x) * 4)) n++; return n / w >= 0.97 }
  const colMat = (x: number) => { let n = 0; for (let y = 0; y < h; y++) if (isMat((y * w + x) * 4)) n++; return n / h >= 0.9 }
  const limY = Math.floor(h * 0.3), limX = Math.floor(w * 0.3)
  let top = 0; while (top < limY && rowMat(top)) top++
  let bottom = 0; while (bottom < limY && rowMat(h - 1 - bottom)) bottom++
  let left = 0; while (left < limX && colMat(left)) left++
  let right = 0; while (right < limX && colMat(w - 1 - right)) right++
  // 4辺のうち、帯が見つかったのが1辺だけなら、帯ではない（その辺が、もともと灰色の面）
  const found = [top, bottom, left, right].filter((v) => v > 2).length
  if (found < 3) return { top: 0, right: 0, bottom: 0, left: 0 }
  // 縁のにじみを避けるため、少し内側まで切る
  const pad = 3
  return { top: (top + pad) / h, bottom: (bottom + pad) / h, left: (left + pad) / w, right: (right + pad) / w }
}

/**
 * 生成した画像（data URL）を、面の実寸の縦横比に切り出す（ブラウザ）。灰色の額縁があれば、先に切り落とす。
 * 失敗したとき（画像が読めない・canvas が使えない）は、元の画像をそのまま返す（貼れなくなるより、少し切れるほうがよい）。
 */
export async function cropImageToAspect(src: string, target: number, maxWidth = 2048): Promise<string> {
  try {
    if (typeof document === 'undefined' || !src.startsWith('data:image/')) return src
    const img = new Image()
    await new Promise<void>((ok, ng) => {
      img.onload = () => ok()
      img.onerror = () => ng(new Error('image'))
      img.src = src
    })
    // 灰色の額縁（台紙）の付いた画像は、額縁を切り落としてから、面の縦横比に合わせる
    let iw = img.naturalWidth, ih = img.naturalHeight, ox = 0, oy = 0
    const probe = document.createElement('canvas')
    const pw = 240, ph = Math.max(1, Math.round((240 * ih) / iw))
    probe.width = pw
    probe.height = ph
    const pctx = probe.getContext('2d', { willReadFrequently: true })
    if (pctx) {
      pctx.drawImage(img, 0, 0, pw, ph)
      const f = grayFrameInset(pctx.getImageData(0, 0, pw, ph).data, pw, ph)
      if (f.top + f.bottom + f.left + f.right > 0) {
        ox = Math.round(f.left * iw); oy = Math.round(f.top * ih)
        iw = Math.round(iw * (1 - f.left - f.right)); ih = Math.round(ih * (1 - f.top - f.bottom))
      }
    }
    const b0 = cropBox(iw, ih, target)
    const box = { sx: ox + b0.sx, sy: oy + b0.sy, sw: b0.sw, sh: b0.sh }
    if (box.sx === 0 && box.sy === 0 && box.sw === img.naturalWidth && box.sh === img.naturalHeight) return src
    const scale = Math.min(1, maxWidth / box.sw)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(box.sw * scale))
    canvas.height = Math.max(1, Math.round(box.sh * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return src
    ctx.drawImage(img, box.sx, box.sy, box.sw, box.sh, 0, 0, canvas.width, canvas.height)
    // 文字がにじまないよう、画質を高めにする。WebP に対応しない端末は PNG になる
    const out = canvas.toDataURL('image/webp', 0.92)
    return out.startsWith('data:image/') ? out : src
  } catch {
    return src
  }
}

/**
 * 見本の画像を、参照画像として渡せる大きさ・形にする（ブラウザ）。長い辺を maxSide に縮めた PNG の base64（data URL の頭は付けない）。
 * 参照は 4MB 以下の PNG だけ受け付けるので、2K の画像をそのまま渡さない。失敗したときは undefined（参照なしで作る）。
 */
export async function toReferencePng(src: string, maxSide = 1024): Promise<string | undefined> {
  try {
    if (typeof document === 'undefined' || !src.startsWith('data:image/')) return undefined
    const img = new Image()
    await new Promise<void>((ok, ng) => {
      img.onload = () => ok()
      img.onerror = () => ng(new Error('image'))
      img.src = src
    })
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const b64 = canvas.toDataURL('image/png').split(',')[1]
    return b64 && b64.length * 0.75 < 3.5 * 1024 * 1024 ? b64 : undefined
  } catch {
    return undefined
  }
}
