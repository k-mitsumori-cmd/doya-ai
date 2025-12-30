import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

export type ArticleBannerPlan = {
  genre: string
  mainCopy: string
  subCopy: string
  supportingPoints: string[]
  visualConcept: string
  palette: string
  layout: string
  designIntent: string
}

export function guessArticleGenreJa(text: string): string {
  const t = String(text || '').toLowerCase()
  if (/転職|採用|求人|rpo|人材|hr/.test(t)) return '転職/採用'
  if (/itスクール|プログラミングスクール|スクール|学習|教育|研修|資格/.test(t)) return 'ITスクール/学習'
  if (/美容|コスメ|サロン|エステ|スキンケア/.test(t)) return '美容'
  if (/健康|医療|ヘルスケア|病院|福祉|ダイエット/.test(t)) return '健康'
  if (/ec|通販|物販|ショップ|d2c|楽天|アマゾン|amazon/.test(t)) return 'EC'
  if (/ai|人工知能|機械学習|llm|gpt/.test(t)) return 'AI'
  if (/不動産|物件|住宅|建築|リノベ/.test(t)) return '不動産'
  if (/金融|投資|資産|保険|fintech/.test(t)) return '金融'
  if (/マーケ|広告|sns|instagram|twitter|x\\b|meta/.test(t)) return 'マーケティング'
  return 'ビジネス'
}

function sanitizeLine(s: string, max = 60): string {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) : t
}

export async function generateArticleBannerPlan(args: {
  title: string
  headings: string[]
  excerpt: string
  keywords?: string[]
  persona?: string
  searchIntent?: string
  requestText?: string
  usage?: string
  genreHint?: string
}): Promise<ArticleBannerPlan> {
  const title = sanitizeLine(args.title, 120)
  const headings = (args.headings || []).map((h) => sanitizeLine(h, 60)).filter(Boolean).slice(0, 12)
  const excerpt = String(args.excerpt || '').replace(/\s+/g, ' ').trim().slice(0, 1200)
  const keywords = (args.keywords || []).map((k) => sanitizeLine(k, 30)).filter(Boolean).slice(0, 10)
  const persona = sanitizeLine(args.persona || '', 120)
  const searchIntent = sanitizeLine(args.searchIntent || '', 160)
  const requestText = String(args.requestText || '').trim().slice(0, 800)
  const usage = sanitizeLine(args.usage || '記事一覧/SNS', 80)
  const genre = sanitizeLine(args.genreHint || guessArticleGenreJa([title, headings.join(' '), excerpt, keywords.join(' ')].join(' ')), 40)

  const prompt = [
    'あなたは「記事バナー（アイキャッチ）」制作に強いアートディレクター兼マーケターAIです。',
    '目的: 記事タイトル・見出し・本文要点から、内容に乖離しない“記事バナー用のコピー案”と“デザイン方針”を作る。',
    '',
    '重要:',
    '- これは広告バナーではない。CTA文言（詳しくはこちら/今すぐ等）は絶対に入れない。',
    '- 記事内容とズレた煽りは禁止。断定/誇張は避ける。',
    '- 情報過多は禁止。テキストブロックは最大3要素（メイン/サブ/補足）まで。',
    '- スマホで一瞬で読める前提で、短く太いコピーにする。',
    '',
    '入力:',
    `- 記事タイトル: ${title}`,
    headings.length ? `- 見出し要点: ${headings.join(' / ')}` : '',
    genre ? `- 記事ジャンル: ${genre}` : '',
    keywords.length ? `- キーワード: ${keywords.join(', ')}` : '',
    persona ? `- 想定ターゲット: ${persona}` : '',
    searchIntent ? `- 検索意図: ${searchIntent}` : '',
    requestText ? `- 主な訴求ポイント（一次情報）: ${requestText}` : '',
    `- 使用用途: ${usage}`,
    excerpt ? `- 本文要点（抜粋）: ${excerpt}` : '',
    '',
    '出力: JSONのみ（途中で切らない）。',
    'スキーマ:',
    '{"genre":"ビジネス","mainCopy":"20文字前後","subCopy":"30文字前後","supportingPoints":["15文字前後","15文字前後"],"visualConcept":"ビジュアルの中心アイデア","palette":"配色（例:青/ネイビー）","layout":"レイアウト方針（余白/配置）","designIntent":"1〜2行の意図"}',
  ]
    .filter(Boolean)
    .join('\n')

  const out = await geminiGenerateJson<ArticleBannerPlan>(
    {
      model: GEMINI_TEXT_MODEL_DEFAULT,
      prompt,
      generationConfig: { temperature: 0.35, maxOutputTokens: 1200 },
    },
    'JSON'
  ).catch(() => null)

  const safe: ArticleBannerPlan = {
    genre,
    mainCopy: sanitizeLine(out?.mainCopy || title || '要点を整理', 60),
    subCopy: sanitizeLine(out?.subCopy || headings[0] || '記事のポイントを一目で', 80),
    supportingPoints: (Array.isArray(out?.supportingPoints) ? out!.supportingPoints : [])
      .map((x) => sanitizeLine(x, 40))
      .filter(Boolean)
      .slice(0, 2),
    visualConcept: sanitizeLine(out?.visualConcept || '記事内容を象徴するビジュアル', 120),
    palette: sanitizeLine(out?.palette || '青/ネイビー基調（信頼感）', 80),
    layout: sanitizeLine(out?.layout || '余白多め、情報は3ブロックまで', 120),
    designIntent: sanitizeLine(out?.designIntent || '記事の要点が直感的に伝わるように整理', 140),
  }

  // CTAっぽい文言の混入を保険で除去（ルール強制）
  const ban = /(詳しくはこちら|今すぐ|チェック|無料で|申込|申し込み|購入|登録|クリック)/g
  safe.mainCopy = safe.mainCopy.replace(ban, '').trim()
  safe.subCopy = safe.subCopy.replace(ban, '').trim()
  safe.supportingPoints = safe.supportingPoints.map((s) => s.replace(ban, '').trim()).filter(Boolean)
  return safe
}

export function formatBannerPlanDescription(plan: ArticleBannerPlan): string {
  const lines: string[] = []
  lines.push('=== COPY_PLAN（記事バナー：CTAなし）===')
  lines.push(`genre: ${plan.genre}`)
  lines.push(`main: ${plan.mainCopy}`)
  lines.push(`sub: ${plan.subCopy}`)
  if (plan.supportingPoints?.length) {
    lines.push(`support: ${plan.supportingPoints.join(' / ')}`)
  }
  lines.push('')
  lines.push('=== DESIGN_INTENT ===')
  lines.push(`concept: ${plan.visualConcept}`)
  lines.push(`palette: ${plan.palette}`)
  lines.push(`layout: ${plan.layout}`)
  lines.push(`intent: ${plan.designIntent}`)
  return lines.join('\n')
}


