import { getLpTheme } from './themes'
import type { LpDesignTheme } from './types'

interface SectionData {
  type: string
  name: string
  headline?: string | null
  subheadline?: string | null
  body?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  layout?: string
  bgColor?: string | null
  bgImage?: string | null
  items?: Array<{ title?: string; description?: string; icon?: string; image?: string }> | null
}

interface ExportOptions {
  projectName: string
  themeId: string
  sections: SectionData[]
}

/** グリッドレイアウト: 3カラムのグリッドで表示 */
function renderItemsGrid(
  items: Array<{ title?: string; description?: string; icon?: string; image?: string }>,
  theme: LpDesignTheme
): string {
  return `<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
    ${items
      .map(
        (item) => `
      <div class="p-6 rounded-lg border border-gray-200 bg-white/80 shadow-sm text-center">
        ${item.icon ? `<div class="text-3xl mb-3">${item.icon}</div>` : ''}
        ${item.image ? `<img src="${item.image}" alt="${item.title || ''}" class="w-full h-40 object-cover rounded-lg mb-3">` : ''}
        <h3 class="font-bold text-lg mb-2 ${theme.tailwindClasses.heading}">${item.title || ''}</h3>
        <p class="text-sm ${theme.tailwindClasses.body}">${item.description || ''}</p>
      </div>`
      )
      .join('')}
  </div>`
}

/** カードレイアウト: 角丸・影付きのカードスタイル */
function renderItemsCards(
  items: Array<{ title?: string; description?: string; icon?: string; image?: string }>,
  theme: LpDesignTheme
): string {
  return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
    ${items
      .map(
        (item) => `
      <div class="rounded-2xl shadow-lg overflow-hidden bg-white">
        ${item.image ? `<img src="${item.image}" alt="${item.title || ''}" class="w-full h-48 object-cover">` : ''}
        <div class="p-6">
          ${item.icon ? `<div class="text-2xl mb-2">${item.icon}</div>` : ''}
          <h3 class="font-bold text-lg mb-2 ${theme.tailwindClasses.heading}">${item.title || ''}</h3>
          <p class="text-sm ${theme.tailwindClasses.body} leading-relaxed">${item.description || ''}</p>
        </div>
      </div>`
      )
      .join('')}
  </div>`
}

/** left-right / right-left: テキストとコンテンツの2カラム配置 */
function renderLeftRight(
  section: SectionData,
  theme: LpDesignTheme,
  reverse: boolean
): string {
  const textBlock = `
    <div class="flex-1 ${reverse ? 'md:order-2' : ''}">
      ${section.headline ? `<h2 class="text-3xl md:text-4xl ${theme.tailwindClasses.heading} mb-4">${section.headline}</h2>` : ''}
      ${section.subheadline ? `<p class="text-xl ${theme.tailwindClasses.accent} mb-4">${section.subheadline}</p>` : ''}
      ${section.body ? `<div class="prose prose-lg ${theme.tailwindClasses.body}">${section.body.replace(/\n/g, '<br>')}</div>` : ''}
      ${section.ctaText ? `<div class="mt-6"><a href="${section.ctaUrl || '#'}" class="${theme.tailwindClasses.button} inline-block">${section.ctaText}</a></div>` : ''}
    </div>`

  const contentBlock = section.items && section.items.length > 0
    ? `<div class="flex-1 ${reverse ? 'md:order-1' : ''}">
        <div class="space-y-4">
          ${section.items
            .map(
              (item) => `
            <div class="bg-white/80 rounded-xl p-4 shadow-sm border border-gray-100">
              ${item.icon ? `<span class="text-xl mr-2">${item.icon}</span>` : ''}
              <h4 class="font-bold ${theme.tailwindClasses.heading} mb-1">${item.title || ''}</h4>
              <p class="text-sm ${theme.tailwindClasses.body}">${item.description || ''}</p>
            </div>`
            )
            .join('')}
        </div>
      </div>`
    : `<div class="flex-1 ${reverse ? 'md:order-1' : ''}">
        <div class="bg-gray-100 rounded-2xl h-64 flex items-center justify-center">
          <span class="text-gray-400 text-sm">コンテンツ画像</span>
        </div>
      </div>`

  return `<div class="flex flex-col md:flex-row gap-10 items-center">
    ${textBlock}
    ${contentBlock}
  </div>`
}

function renderSection(section: SectionData, theme: LpDesignTheme, idx: number): string {
  const isHero = section.type === 'hero'
  const isCta = section.type === 'cta'
  const isFooter = section.type === 'footer'
  const layout = section.layout || 'center'

  // 背景クラスの決定
  let bgClass = idx % 2 === 0 ? theme.tailwindClasses.section : 'bg-gray-50'
  if (isHero) bgClass = theme.tailwindClasses.hero
  if (isCta) bgClass = theme.tailwindClasses.hero
  if (isFooter) bgClass = 'bg-gray-900 text-white'

  // カスタム背景色で上書き
  const bgStyle = section.bgColor ? ` style="background-color: ${section.bgColor};"` : ''

  // 背景画像のスタイル
  const bgImageStyle = section.bgImage
    ? ` style="background-image: url('${section.bgImage}'); background-size: cover; background-position: center;${section.bgColor ? ` background-color: ${section.bgColor};` : ''}"`
    : bgStyle
  const bgOverlay = section.bgImage
    ? `<div class="absolute inset-0 bg-black/50"></div>`
    : ''
  const relativeClass = section.bgImage ? ' relative' : ''
  const contentZClass = section.bgImage ? ' relative z-10' : ''

  // left-right / right-left レイアウト
  if (layout === 'left-right' || layout === 'right-left') {
    return `
  <!-- ${section.name} -->
  <section class="py-16 px-4 ${bgClass}${relativeClass}" id="section-${idx}"${bgImageStyle}>
    ${bgOverlay}
    <div class="max-w-5xl mx-auto${contentZClass}">
      ${renderLeftRight(section, theme, layout === 'right-left')}
    </div>
  </section>`
  }

  // grid / cards レイアウトのアイテム表示
  let itemsHtml = ''
  if (section.items && section.items.length > 0) {
    if (layout === 'cards') {
      itemsHtml = renderItemsCards(section.items, theme)
    } else if (layout === 'grid') {
      itemsHtml = renderItemsGrid(section.items, theme)
    } else {
      // center: デフォルトのグリッド表示
      itemsHtml = renderItemsGrid(section.items, theme)
    }
  }

  const ctaHtml = section.ctaText
    ? `<div class="mt-8 text-center">
        <a href="${section.ctaUrl || '#'}" class="${theme.tailwindClasses.button} inline-block">
          ${section.ctaText}
        </a>
      </div>`
    : ''

  return `
  <!-- ${section.name} -->
  <section class="py-16 px-4 ${bgClass}${relativeClass}" id="section-${idx}"${bgImageStyle}>
    ${bgOverlay}
    <div class="max-w-4xl mx-auto text-center${contentZClass}">
      ${section.headline ? `<h2 class="text-3xl md:text-4xl ${theme.tailwindClasses.heading} mb-4">${section.headline}</h2>` : ''}
      ${section.subheadline ? `<p class="text-xl ${theme.tailwindClasses.accent} mb-6">${section.subheadline}</p>` : ''}
      ${section.body ? `<div class="prose prose-lg max-w-2xl mx-auto ${theme.tailwindClasses.body} text-left">${section.body.replace(/\n/g, '<br>')}</div>` : ''}
      ${itemsHtml}
      ${ctaHtml}
    </div>
  </section>`
}

export function generateHtml(opts: ExportOptions): string {
  const theme = getLpTheme(opts.themeId)
  const sectionsHtml = opts.sections.map((s, i) => renderSection(s, theme, i)).join('\n')

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.projectName}</title>
  <meta name="description" content="${opts.projectName}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Noto+Serif+JP:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Noto Sans JP', sans-serif; }
    .prose p { margin-bottom: 1rem; }
    .prose ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
    .prose li { margin-bottom: 0.5rem; }
  </style>
</head>
<body class="antialiased">
  <!-- Generated by ドヤLP AI - https://doya-ai.surisuta.jp -->
${sectionsHtml}
</body>
</html>`
}
