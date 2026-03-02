import type {
  BrandPalette,
  DoyaLogoInput,
  GeneratedLogoFile,
  GeneratedLogoProject,
  GeneratedPattern,
  LogoLayout,
  LogoMode,
  LogoPatternId,
} from './types'
import { generateGuidelineMarkdown } from './guidelineGenerator'
import { paletteMarkdown } from './paletteGenerator'
import { loadMarkFromTemplate, type TemplateId } from './templateLoader'
import { escapeXml, readableTextColor, slugify, stableSeed } from './utils'

const VERSION = '0.1.0'

type PatternSpec = {
  id: LogoPatternId
  title: string
  description: string
  template: TemplateId
}

const PATTERNS: PatternSpec[] = [
  {
    id: 'A',
    title: '王道・汎用（信頼感）',
    description: '読みやすさと余白を最優先。Web/SNS/資料に展開しやすい、失敗しない骨格。',
    template: 'japanese-modern',
  },
  {
    id: 'B',
    title: '攻めた・個性的（記号性）',
    description: '和の記号性（角印/印影の抽象）を少し強めに。覚えられるフックと輪郭の強さ。',
    template: 'japanese-bold',
  },
  {
    id: 'C',
    title: 'ミニマル・長期運用（縮小耐性）',
    description: '最小要素で成立させる設計。アイコン/プロダクト内UIで崩れにくい長期型。',
    template: 'japanese-minimal',
  },
]

function dims(layout: LogoLayout) {
  if (layout === 'horizontal') return { width: 1200, height: 320, viewBox: '0 0 1200 320' }
  return { width: 512, height: 512, viewBox: '0 0 512 512' }
}

function modeColors(mode: LogoMode, palette: BrandPalette): { bg: string; text: string; mark: string } {
  if (mode === 'dark') {
    const bg = '#0B0F1A'
    return { bg, text: '#FFFFFF', mark: palette.accent.hex }
  }
  if (mode === 'mono') {
    return { bg: '#FFFFFF', text: '#111827', mark: '#111827' }
  }
  if (mode === 'invert') {
    const bg = palette.primary.hex
    return { bg, text: readableTextColor(bg), mark: readableTextColor(bg) }
  }
  return { bg: palette.background.hex, text: palette.text.hex, mark: palette.primary.hex }
}

export function optimizeSvgForFigma(svg: string): string {
  // Keep viewBox, remove excessive whitespace / comments. Figma prefers clean SVG.
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim()
}

function renderLogoSvg(args: {
  layout: LogoLayout
  mode: LogoMode
  markInnerSvg: string
  input: DoyaLogoInput
  palette: BrandPalette
  patternId: LogoPatternId
}): string {
  const { layout, mode, markInnerSvg, input, palette, patternId } = args
  const { width, height, viewBox } = dims(layout)
  const c = modeColors(mode, palette)
  const name = escapeXml(input.serviceName)
  const sub = escapeXml(input.serviceDescription)

  // NOTE: XML属性として安全な形式にする（JSON.stringifyで\"を混ぜるとSVGパーサが壊れる）
  const fontFamily = escapeXml(
    [
      'Noto Sans JP',
      'Hiragino Sans',
      'Yu Gothic',
      'Meiryo',
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'sans-serif',
    ].join(', ')
  )

  // pattern-specific typography tweaks
  const weight = patternId === 'B' ? 800 : patternId === 'C' ? 600 : 700
  const tracking = patternId === 'C' ? 2 : 0.5

  if (layout === 'horizontal') {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}" role="img" aria-label="${name} logo">`,
      // mark
      `<g transform="translate(64,64) scale(0.38)" style="color:${c.mark}">${markInnerSvg}</g>`,
      // wordmark (Japanese whitespace-ish)
      `<g transform="translate(330,102)">`,
      `<text x="0" y="0" fill="${c.text}" font-family="${fontFamily}" font-size="84" font-weight="${weight}" letter-spacing="${tracking}">${name}</text>`,
      `<text x="2" y="66" fill="${c.text}" opacity="0.75" font-family="${fontFamily}" font-size="22" font-weight="500" letter-spacing="0.2">${sub}</text>`,
      `</g>`,
      // subtle divider for "ma" (only in A/C)
      ...(patternId !== 'B'
        ? [`<rect x="300" y="84" width="2" height="152" fill="${c.text}" opacity="0.10"/>`]
        : []),
      `</svg>`,
    ].join('')
  }

  // square
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}" role="img" aria-label="${name} icon">`,
    `<g transform="translate(156,110) scale(0.52)" style="color:${c.mark}">${markInnerSvg}</g>`,
    `<text x="256" y="410" text-anchor="middle" fill="${c.text}" font-family="${fontFamily}" font-size="46" font-weight="${weight}" letter-spacing="${tracking}">${name}</text>`,
    `</svg>`,
  ].join('')
}

export function buildBaseReasons(input: DoyaLogoInput, pattern: PatternSpec, palette: BrandPalette): string {
  return [
    `## Pattern ${pattern.id}: ${pattern.title}`,
    '',
    '### なぜこの形なのか',
    `- ${pattern.description}`,
    '- 「余白（間）」を残す構造にして、縮小時も“詰まり”を起こしにくくしています。',
    '- 日本のプロダクト文脈で多い「文字が主役」になれる骨格（マークは邪魔をしない）を狙っています。',
    '',
    '### なぜこの色なのか',
    `- primary（${palette.primary.hex}）を軸に、信頼感と識別性を両立する配色にしています。`,
    `- secondary（${palette.secondary.hex}）は補助的に、accent（${palette.accent.hex}）はCTAや強調で効かせる設計です。`,
    '',
    '### サービス内容とどう紐づいているか',
    `- 「${input.serviceDescription}」という提供価値を、過剰な演出ではなく“整った印象”で支える方向に寄せています。`,
    '',
    '### 長期運用で強い理由',
    '- フラット前提・単色中心で、媒体ごとの劣化（印刷、圧縮、縮小）に強い',
    '- 横長/正方形の両運用を前提に、SNS・Web・資料で破綻しにくい',
    '',
    '### 注意（商標・類似ロゴ）',
    '- 本出力は自動生成のため、類似ロゴが存在する可能性があります。採用前に**同業・近似領域の商標/ロゴ**の確認を推奨します（法的判断ではありません）。',
  ].join('\n')
}

export function buildGrowthStory(input: DoyaLogoInput, patternId: LogoPatternId): string {
  const base = [
    `## 成長ストーリー（Pattern ${patternId}）`,
    '',
    '- **今（MVP）**: ロゴは“約束”を明確にする。余白と読みやすさを最優先。',
    '- **拡張（機能が増える）**: サブブランド/機能タグを付けても崩れない余白設計で拡張。',
    '- **成熟（複数プロダクト）**: アイコン（square）を共通の“紋”として据え、色・補助図形で差分を作る。',
    '',
    `サービス「${input.serviceName}」が成長しても、ロゴの骨格はそのままに“運用で強い”体系に伸ばせます。`,
  ]
  return base.join('\n')
}

export function buildOneLiner(input: DoyaLogoInput, patternId: LogoPatternId): string {
  const tone = patternId === 'B' ? '輪郭の強い記号性' : patternId === 'C' ? '最小要素の強さ' : '余白と信頼感'
  return `「${input.serviceName}」のロゴは、${tone}で「${input.serviceDescription}」を長期運用前提で支える設計です。`
}

export function buildTrademarkNote(input: DoyaLogoInput): string {
  return [
    '## 類似ロゴ注意（商標チェックの補助）',
    '',
    '- 採用前に、同業他社・近似カテゴリのロゴを目視で比較してください。',
    '- 可能であれば、商標データベースで「サービス名」「略称」「ロゴの印象（角印/円相/幾何）」を含めて検索してください。',
    '- これは一般的な注意喚起であり、法的判断・保証ではありません。',
    '',
    `対象: ${input.serviceName}`,
  ].join('\n')
}

export async function generateLogoProject(args: {
  input: DoyaLogoInput
  palettes: Record<LogoPatternId, BrandPalette>
}): Promise<GeneratedLogoProject> {
  const { input, palettes } = args
  const serviceSlug = slugify(input.serviceName)
  const seed = stableSeed({ ...input, serviceSlug })

  const patterns: GeneratedPattern[] = []

  for (const p of PATTERNS) {
    const palette = palettes[p.id]
    const markInnerSvg = await loadMarkFromTemplate(p.template)

    const logos: GeneratedLogoFile[] = []
    const layouts: LogoLayout[] = ['horizontal', 'square']
    const modes: LogoMode[] = ['default', 'dark', 'mono', 'invert']

    for (const layout of layouts) {
      for (const mode of modes) {
        const svg = renderLogoSvg({ layout, mode, markInnerSvg, input, palette, patternId: p.id })
        const figma = optimizeSvgForFigma(svg)
        const base = `${serviceSlug}-pattern-${p.id.toLowerCase()}-${layout}-${mode}`
        logos.push({
          layout,
          mode,
          svg: { filename: `${base}.svg`, content: svg },
          figmaSvg: { filename: `${base}.figma.svg`, content: figma },
          png: { filename: `${base}.png` },
          jpeg: { filename: `${base}.jpg` },
        })
      }
    }

    patterns.push({
      id: p.id,
      title: p.title,
      description: p.description,
      palette,
      reasons: buildBaseReasons(input, p, palette),
      growthStory: buildGrowthStory(input, p.id),
      oneLiner: buildOneLiner(input, p.id),
      trademarkNote: buildTrademarkNote(input),
      logos,
    })
  }

  const guidelineMarkdown = generateGuidelineMarkdown(input, patterns)
  const paletteMd = paletteMarkdown({ A: palettes.A, B: palettes.B, C: palettes.C })

  return {
    meta: {
      generator: 'doya-logo',
      version: VERSION,
      createdAt: new Date().toISOString(),
      input,
      serviceSlug,
      seed,
    },
    patterns,
    guidelineMarkdown,
    paletteMarkdown: paletteMd,
  }
}


