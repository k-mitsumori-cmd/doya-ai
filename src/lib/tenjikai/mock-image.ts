// 開発中の画面確認用の見本画像（課金 API を呼ばない）。route.ts の mockMode でだけ使う。
// 縦横比に合わせた SVG を data URL で返す。色は ds トークンの青。
import { ds } from './tokens'

const TONES = [
  [ds.blue, ds.navy],
  [ds.k1, ds.blueDeep],
  [ds.blueDeep, ds.blue],
  [ds.navy, ds.k1],
]

export function mockPanelImage(aspectRatio: string, index = 0): string {
  const [a, b] = aspectRatio.split(':').map(Number)
  const w = 1200
  const h = Math.round((w * (b || 1)) / (a || 1))
  const [c1, c2] = TONES[index % TONES.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<circle cx="${w * 0.78}" cy="${h * 0.3}" r="${Math.min(w, h) * 0.22}" fill="${ds.paper}" opacity=".16"/>
<rect x="${w * 0.08}" y="${h * 0.12}" width="${w * 0.6}" height="${h * 0.08}" rx="8" fill="${ds.paper}" opacity=".9"/>
<rect x="${w * 0.08}" y="${h * 0.26}" width="${w * 0.4}" height="${h * 0.04}" rx="6" fill="${ds.paper}" opacity=".6"/>
<text x="${w / 2}" y="${h * 0.86}" font-size="${Math.round(Math.min(w, h) * 0.07)}" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="${ds.paper}" opacity=".85">見本の画像</text>
</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
