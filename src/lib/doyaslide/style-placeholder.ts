// ========================================
// スタイル見本の静的なイメージ（画像生成を使わない）
// ========================================
// 生成済みの見本画像が無いスタイルでは、色とレイアウトだけを示す SVG を出す。
// ⚠️ 以前は新規作成の画面を開くだけで、見本の無いスタイルの画像を有料APIで自動生成していた。
//    保存に失敗し続けると開くたびに生成が走るため、費用の上限が読めなかった（2026-10-19 原価見直し）。
//    見本画像は管理者が scripts/regenerate-doyaslide-style-previews.ts で明示的に作る。
// ⚠️ このファイルはブラウザーでも使う。サーバー専用のモジュールを import しない。

import { STYLE_PRESETS, STYLE_PREVIEW_SAMPLE_SLIDES, getStylePreviewColor } from './constants'

type Palette = { bg: string; text: string; sub: string; card: string; line: string }

const LIGHT: Palette = { bg: '#ffffff', text: '#0f172a', sub: '#475569', card: '#f1f5f9', line: '#e2e8f0' }
const PALETTES: Record<string, Palette> = {
  luxury: { bg: '#1c1917', text: '#fafaf9', sub: '#d6d3d1', card: '#292524', line: '#44403c' },
  cyber: { bg: '#0b1020', text: '#e0f2fe', sub: '#94a3b8', card: '#111a33', line: '#1e293b' },
  retro: { bg: '#fdf6e3', text: '#3f2a1d', sub: '#7c5a43', card: '#f5e6c8', line: '#e7d3ad' },
  handwritten: { bg: '#fffbeb', text: '#292524', sub: '#57534e', card: '#fef3c7', line: '#fde68a' },
  mono: { bg: '#fafafa', text: '#111827', sub: '#4b5563', card: '#f3f4f6', line: '#e5e7eb' },
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function bullets(subText: string): { lead: string; items: Array<{ label: string; body: string }> } {
  const [lead = '', ...rest] = subText.split('\n')
  const items = rest.map((line) => {
    const [label = '', body = ''] = line.replace(/^・/, '').split('｜')
    return { label, body }
  })
  return { lead, items }
}

function frame(p: Palette, accent: string, label: string, page: number, inner: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" font-family="'Noto Sans JP','Hiragino Sans',sans-serif">`
    + `<rect width="1600" height="900" fill="${p.bg}"/>`
    + inner
    + `<rect x="0" y="880" width="1600" height="20" fill="${accent}" opacity="0.85"/>`
    + `<text x="1540" y="850" text-anchor="end" font-size="24" fill="${p.sub}">${esc(label)}・配色とレイアウトのイメージ ${page}/3</text>`
    + `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** 見本画像の無いスタイルのための、色とレイアウトだけの静的な見本（表紙・本文・まとめの3枚）。 */
export function buildStylePlaceholderPages(style: string): string[] {
  const preset = STYLE_PRESETS.find((s) => s.value === style)
  const label = preset?.label || style
  const accent = getStylePreviewColor(style)
  const p = PALETTES[style] || LIGHT
  const [cover, body, closing] = STYLE_PREVIEW_SAMPLE_SLIDES

  const coverSvg = frame(p, accent, label, 1,
    `<rect x="120" y="300" width="14" height="220" fill="${accent}"/>`
    + `<text x="170" y="400" font-size="92" font-weight="700" fill="${p.text}">${esc(cover.headline)}</text>`
    + `<text x="174" y="490" font-size="40" fill="${p.sub}">${esc(cover.subText)}</text>`
    + `<circle cx="1330" cy="250" r="170" fill="${accent}" opacity="0.18"/>`
    + `<circle cx="1420" cy="380" r="90" fill="${accent}" opacity="0.35"/>`)

  const b = bullets(body.subText)
  const cards = b.items.slice(0, 3).map((item, i) => {
    const x = 120 + i * 470
    return `<rect x="${x}" y="330" width="430" height="400" rx="28" fill="${p.card}" stroke="${p.line}" stroke-width="2"/>`
      + `<rect x="${x + 36}" y="370" width="200" height="56" rx="28" fill="${accent}"/>`
      + `<text x="${x + 136}" y="408" text-anchor="middle" font-size="28" font-weight="700" fill="#ffffff">${esc(item.label)}</text>`
      + `<circle cx="${x + 215}" cy="540" r="62" fill="${accent}" opacity="0.2"/>`
      + `<text x="${x + 36}" y="680" font-size="28" fill="${p.sub}">${esc(item.body)}</text>`
  }).join('')
  const bodySvg = frame(p, accent, label, 2,
    `<text x="120" y="170" font-size="64" font-weight="700" fill="${p.text}">${esc(body.headline)}</text>`
    + `<rect x="120" y="200" width="120" height="8" fill="${accent}"/>`
    + `<text x="120" y="270" font-size="32" fill="${p.sub}">${esc(b.lead)}</text>`
    + cards)

  const c = bullets(closing.subText)
  const closingSvg = frame(p, accent, label, 3,
    `<text x="800" y="290" text-anchor="middle" font-size="76" font-weight="700" fill="${p.text}">${esc(closing.headline)}</text>`
    + `<text x="800" y="370" text-anchor="middle" font-size="34" fill="${p.sub}">${esc(c.lead)}</text>`
    + `<rect x="560" y="440" width="480" height="104" rx="52" fill="${accent}"/>`
    + `<text x="800" y="507" text-anchor="middle" font-size="36" font-weight="700" fill="#ffffff">お問い合わせ</text>`
    + c.items.slice(0, 2).map((item, i) => `<text x="800" y="${640 + i * 56}" text-anchor="middle" font-size="30" fill="${p.sub}">${esc(item.label)}｜${esc(item.body)}</text>`).join(''))

  return [coverSvg, bodySvg, closingSvg]
}
