import type { LpSectionDef, LpSectionType } from './types'

interface WireframeOptions {
  width?: number
  baseHeight?: number
}

const COLORS = {
  bg: '#f8fafc',
  block: '#e2e8f0',
  blockAlt: '#f1f5f9',
  text: '#94a3b8',
  textDark: '#64748b',
  accent: '#475569',
  button: '#64748b',
  hero: '#cbd5e1',
  footer: '#334155',
  footerText: '#94a3b8',
  border: '#e2e8f0',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** テキスト行のプレースホルダー */
function textLine(x: number, y: number, w: number, h: number = 8): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${COLORS.text}" opacity="0.5"/>`
}

/** CTAボタンプレースホルダー */
function ctaButton(cx: number, y: number, w: number = 100, h: number = 28): string {
  return `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${COLORS.button}"/>
    <rect x="${cx - 25}" y="${y + 10}" width="50" height="8" rx="4" fill="white" opacity="0.8"/>`
}

/** セクションラベル */
function sectionLabel(x: number, y: number, label: string): string {
  return `<text x="${x}" y="${y}" font-size="9" fill="${COLORS.textDark}" font-family="sans-serif" font-weight="600" opacity="0.7">${escapeXml(label)}</text>`
}

/** カードグリッド（features/proof等） */
function cardGrid(x: number, y: number, w: number, count: number = 3): string {
  const gap = 8
  const cardW = (w - gap * (count - 1)) / count
  const cardH = 50
  let svg = ''
  for (let i = 0; i < count; i++) {
    const cx = x + (cardW + gap) * i
    svg += `<rect x="${cx}" y="${y}" width="${cardW}" height="${cardH}" rx="6" fill="${COLORS.card}" stroke="${COLORS.cardBorder}" stroke-width="1"/>
      <rect x="${cx + 10}" y="${y + 12}" width="${cardW - 20}" height="6" rx="3" fill="${COLORS.text}" opacity="0.4"/>
      <rect x="${cx + 10}" y="${y + 24}" width="${cardW * 0.6}" height="5" rx="2.5" fill="${COLORS.text}" opacity="0.25"/>
      <rect x="${cx + 10}" y="${y + 33}" width="${cardW * 0.5}" height="5" rx="2.5" fill="${COLORS.text}" opacity="0.2"/>`
  }
  return svg
}

/** testimonialカード */
function testimonialCards(x: number, y: number, w: number): string {
  const cardW = (w - 12) / 2
  const cardH = 55
  let svg = ''
  for (let i = 0; i < 2; i++) {
    const cx = x + (cardW + 12) * i
    // アバター
    svg += `<rect x="${cx}" y="${y}" width="${cardW}" height="${cardH}" rx="6" fill="${COLORS.card}" stroke="${COLORS.cardBorder}" stroke-width="1"/>
      <circle cx="${cx + 18}" cy="${y + 18}" r="10" fill="${COLORS.block}"/>
      <rect x="${cx + 34}" y="${y + 12}" width="${cardW * 0.4}" height="5" rx="2.5" fill="${COLORS.text}" opacity="0.5"/>
      <rect x="${cx + 34}" y="${y + 21}" width="${cardW * 0.3}" height="4" rx="2" fill="${COLORS.text}" opacity="0.25"/>
      <rect x="${cx + 10}" y="${y + 36}" width="${cardW - 20}" height="5" rx="2.5" fill="${COLORS.text}" opacity="0.3"/>
      <rect x="${cx + 10}" y="${y + 44}" width="${cardW * 0.5}" height="4" rx="2" fill="${COLORS.text}" opacity="0.2"/>`
  }
  return svg
}

/** FAQアコーディオン */
function faqLines(x: number, y: number, w: number, count: number = 3): string {
  const lineH = 22
  let svg = ''
  for (let i = 0; i < count; i++) {
    const ly = y + lineH * i
    svg += `<rect x="${x}" y="${ly}" width="${w}" height="${lineH - 4}" rx="4" fill="${COLORS.card}" stroke="${COLORS.cardBorder}" stroke-width="1"/>
      <rect x="${x + 12}" y="${ly + 7}" width="${w * 0.5}" height="5" rx="2.5" fill="${COLORS.text}" opacity="0.4"/>
      <text x="${x + w - 16}" y="${ly + 12}" font-size="10" fill="${COLORS.text}" font-family="sans-serif">+</text>`
  }
  return svg
}

/** pricingテーブル */
function pricingBlock(x: number, y: number, w: number): string {
  const blockW = (w - 16) / 3
  const blockH = 70
  let svg = ''
  for (let i = 0; i < 3; i++) {
    const bx = x + (blockW + 8) * i
    const isPrimary = i === 1
    svg += `<rect x="${bx}" y="${y}" width="${blockW}" height="${blockH}" rx="6" fill="${isPrimary ? COLORS.hero : COLORS.card}" stroke="${isPrimary ? COLORS.accent : COLORS.cardBorder}" stroke-width="${isPrimary ? 2 : 1}"/>
      <rect x="${bx + 10}" y="${y + 10}" width="${blockW - 20}" height="6" rx="3" fill="${isPrimary ? COLORS.accent : COLORS.text}" opacity="${isPrimary ? 0.7 : 0.4}"/>
      <rect x="${bx + 15}" y="${y + 24}" width="${blockW * 0.5}" height="8" rx="4" fill="${isPrimary ? COLORS.accent : COLORS.text}" opacity="${isPrimary ? 0.8 : 0.5}"/>
      <rect x="${bx + 10}" y="${y + 40}" width="${blockW - 20}" height="4" rx="2" fill="${COLORS.text}" opacity="0.2"/>
      <rect x="${bx + 10}" y="${y + 48}" width="${blockW - 20}" height="4" rx="2" fill="${COLORS.text}" opacity="0.2"/>
      <rect x="${bx + 15}" y="${y + 58}" width="${blockW - 30}" height="6" rx="3" fill="${isPrimary ? COLORS.button : COLORS.text}" opacity="${isPrimary ? 1 : 0.3}"/>`
  }
  return svg
}

/** セクションタイプ別の内部コンテンツ */
function renderSectionContent(
  type: LpSectionType | string,
  x: number,
  y: number,
  w: number,
  h: number,
  hasCta: boolean,
  name: string
): string {
  const pad = 16
  const cx = x + w / 2
  const contentX = x + pad
  const contentW = w - pad * 2
  let svg = ''

  switch (type) {
    case 'hero':
      // 画像プレースホルダー（背景）
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${COLORS.hero}" opacity="0.3"/>`
      // テキスト
      svg += textLine(cx - 80, y + h * 0.25, 160, 12)
      svg += textLine(cx - 60, y + h * 0.25 + 20, 120, 6)
      svg += textLine(cx - 50, y + h * 0.25 + 32, 100, 6)
      if (hasCta) svg += ctaButton(cx, y + h * 0.6)
      break

    case 'features':
      svg += textLine(cx - 60, y + 16, 120, 10)
      svg += textLine(cx - 40, y + 32, 80, 5)
      svg += cardGrid(contentX, y + 48, contentW, 3)
      break

    case 'testimonial':
      svg += textLine(cx - 50, y + 16, 100, 10)
      svg += testimonialCards(contentX, y + 36, contentW)
      break

    case 'faq':
      svg += textLine(cx - 40, y + 16, 80, 10)
      svg += faqLines(contentX, y + 36, contentW, Math.min(4, Math.floor((h - 50) / 22)))
      break

    case 'pricing':
      svg += textLine(cx - 50, y + 16, 100, 10)
      svg += pricingBlock(contentX, y + 36, contentW)
      break

    case 'cta':
      svg += textLine(cx - 70, y + h * 0.2, 140, 12)
      svg += textLine(cx - 50, y + h * 0.2 + 20, 100, 6)
      svg += ctaButton(cx, y + h * 0.55, 120, 32)
      break

    case 'footer':
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${COLORS.footer}"/>`
      svg += textLine(cx - 40, y + h * 0.3, 80, 5)
      svg += textLine(cx - 60, y + h * 0.5, 120, 4)
      svg += sectionLabel(contentX + 4, y + h - 8, name)
      return svg

    case 'problem':
    case 'empathy':
      svg += textLine(cx - 60, y + 16, 120, 10)
      svg += textLine(contentX, y + 36, contentW * 0.8, 5)
      svg += textLine(contentX, y + 46, contentW * 0.6, 5)
      svg += textLine(contentX, y + 56, contentW * 0.7, 5)
      if (hasCta) svg += ctaButton(cx, y + h - 44)
      break

    case 'solution':
      svg += textLine(cx - 60, y + 16, 120, 10)
      svg += textLine(cx - 45, y + 32, 90, 5)
      svg += cardGrid(contentX, y + 48, contentW, 2)
      if (hasCta) svg += ctaButton(cx, y + h - 44)
      break

    case 'proof':
      svg += textLine(cx - 50, y + 16, 100, 10)
      svg += cardGrid(contentX, y + 36, contentW, 3)
      break

    case 'company':
      svg += textLine(cx - 40, y + 16, 80, 10)
      svg += textLine(contentX, y + 36, contentW * 0.7, 5)
      svg += textLine(contentX, y + 46, contentW * 0.5, 5)
      break

    default:
      svg += textLine(cx - 50, y + 16, 100, 10)
      svg += textLine(contentX, y + 32, contentW * 0.7, 5)
      svg += textLine(contentX, y + 42, contentW * 0.5, 5)
      if (hasCta) svg += ctaButton(cx, y + h - 44)
      break
  }

  // セクションラベル（footer以外）
  if (type !== 'footer') {
    svg += sectionLabel(contentX + 2, y + h - 6, name)
  }

  return svg
}

/** LP構成からワイヤーフレームSVGを生成 */
export function generateWireframeSvg(
  sections: LpSectionDef[],
  options?: WireframeOptions
): string {
  const width = options?.width ?? 400
  const baseH = options?.baseHeight ?? 120

  // セクションの高さを計算
  const sectionHeights = sections.map((s) => {
    const ratio = s.heightRatio || 0.8
    return Math.max(60, Math.round(baseH * ratio))
  })

  const totalHeight = sectionHeights.reduce((a, b) => a + b, 0) + 2

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" width="${width}" height="${totalHeight}">
  <defs>
    <filter id="wf-shadow" x="-2%" y="-1%" width="104%" height="102%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect width="${width}" height="${totalHeight}" fill="${COLORS.bg}" rx="8"/>`

  let currentY = 1
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]
    const h = sectionHeights[i]
    const isEven = i % 2 === 0

    // セクション背景
    if (sec.type !== 'footer') {
      svg += `<rect x="1" y="${currentY}" width="${width - 2}" height="${h}" fill="${isEven ? 'white' : COLORS.blockAlt}"/>`
      // 区切り線
      if (i > 0) {
        svg += `<line x1="1" y1="${currentY}" x2="${width - 1}" y2="${currentY}" stroke="${COLORS.border}" stroke-width="0.5"/>`
      }
    }

    // セクションコンテンツ
    svg += renderSectionContent(
      sec.type,
      1,
      currentY,
      width - 2,
      h,
      sec.hasCta ?? false,
      sec.name
    )

    currentY += h
  }

  svg += '</svg>'
  return svg
}
