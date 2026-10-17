// ============================================
// ドヤ社内インタビュー サムネイル画像
// ============================================
// ⚠️ 画像生成AIは使わない。本人の実写真に文字を重ねてテンプレートで合成する
//    （費用ゼロ・本人以外の顔を作らない）。
// satori で文字を図形化した SVG を作り、sharp で PNG にする。
// フォントは assets/fonts の Noto Sans JP（next.config.js の outputFileTracingIncludes で同梱）。
import fs from 'node:fs'
import path from 'node:path'
import satori from 'satori'
import sharp from 'sharp'

const W = 1200
const H = 630
const PHOTO_W = 600

let fontCache: { regular: Buffer; bold: Buffer } | null = null
function fonts() {
  if (!fontCache) {
    const dir = path.join(process.cwd(), 'assets', 'fonts')
    fontCache = {
      regular: fs.readFileSync(path.join(dir, 'NotoSansJP-Regular.ttf')),
      bold: fs.readFileSync(path.join(dir, 'NotoSansJP-Bold.ttf')),
    }
  }
  return fontCache
}

function normalizeColor(c: string): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : '#c026d3'
}

/** 背景色に対して読みやすい文字色 */
function textColorOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.4 ? '#111827' : '#ffffff'
}

function el(type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}) {
  return { type, props: { style, children, ...extra } }
}

export interface ThumbnailInput {
  photo: Buffer | null
  catchphrase: string
  name: string
  department: string
  position: string
  companyName: string
  brandColor: string
}

export async function renderThumbnail(input: ThumbnailInput): Promise<Buffer> {
  const bg = normalizeColor(input.brandColor)
  const fg = textColorOn(bg)
  const sub = fg === '#ffffff' ? 'rgba(255,255,255,0.78)' : 'rgba(17,24,39,0.7)'

  let photoUri: string | null = null
  if (input.photo) {
    const jpg = await sharp(input.photo).rotate().resize(PHOTO_W, H, { fit: 'cover', position: 'attention' }).jpeg({ quality: 86 }).toBuffer()
    photoUri = `data:image/jpeg;base64,${jpg.toString('base64')}`
  }

  const catchphrase = input.catchphrase || `${input.name}さんインタビュー`
  const size = catchphrase.length <= 12 ? 60 : catchphrase.length <= 18 ? 52 : 44
  const role = [input.department, input.position].filter(Boolean).join(' / ')

  const tree = el(
    'div',
    { width: W, height: H, display: 'flex', backgroundColor: bg, fontFamily: 'Noto Sans JP' },
    [
      el(
        'div',
        { width: W - PHOTO_W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 56px 52px' },
        [
          el('div', { display: 'flex', fontSize: 22, fontWeight: 700, color: sub, letterSpacing: 4 }, 'INTERVIEW'),
          el('div', { display: 'flex', flexDirection: 'column' }, [
            el('div', { display: 'flex', fontSize: 30, fontWeight: 700, color: fg, opacity: 0.9, marginBottom: 8 }, '「'),
            el('div', { display: 'flex', fontSize: size, fontWeight: 700, color: fg, lineHeight: 1.35 }, catchphrase),
            el('div', { display: 'flex', fontSize: 30, fontWeight: 700, color: fg, opacity: 0.9, justifyContent: 'flex-end', marginTop: 8 }, '」'),
          ]),
          el('div', { display: 'flex', flexDirection: 'column' }, [
            el('div', { display: 'flex', fontSize: 40, fontWeight: 700, color: fg }, input.name),
            role ? el('div', { display: 'flex', fontSize: 22, color: sub, marginTop: 6 }, role) : null,
            input.companyName ? el('div', { display: 'flex', fontSize: 22, color: sub, marginTop: 18 }, input.companyName) : null,
          ].filter(Boolean)),
        ]
      ),
      photoUri
        ? el('img', { width: PHOTO_W, height: H, objectFit: 'cover' }, undefined, { src: photoUri, width: PHOTO_W, height: H })
        : el('div', { width: PHOTO_W, height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.12)', color: sub, fontSize: 24 }, '写真を追加すると、ここに表示されます'),
    ]
  )

  const f = fonts()
  const svg = await satori(tree as any, {
    width: W,
    height: H,
    fonts: [
      { name: 'Noto Sans JP', data: f.regular, weight: 400, style: 'normal' },
      { name: 'Noto Sans JP', data: f.bold, weight: 700, style: 'normal' },
    ],
  })
  return sharp(Buffer.from(svg)).png().toBuffer()
}
