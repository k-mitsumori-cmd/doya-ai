// ============================================
// ドヤ広告画像AI コピー確定（画像生成より先に行う）
// ============================================
// ⚠️ コピーは画像生成の前に確定させ、全アスペクトで同一のものを使う。
//    サイズごとに別のコピーを作ると、同じキャンペーンなのに言っていることが
//    バラバラなクリエイティブ群になる。
//
// ⚠️ 焼き込みは文字数が増えるほど字形が崩れやすい。上限をプロンプトで渡し、
//    さらにコード側でも検証して超過分は短縮する（モデルは上限を破る）。
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { APPEAL_LABELS, COPY_LIMITS, type AdCopy, type AppealAxis, type BrandProfile, type ConceptDraft } from './types'

/**
 * 薬機法・景表法まわりの簡易フィルタ。
 * ⚠️ これは法務チェックの代替ではない。断定的な最上級表現など、
 *    広告として明らかに危ういものを機械的に落とすための最低限の網。
 */
const RISKY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /日本一|世界一|No\.?1|ナンバーワン|業界最[高安速大]/i, label: '根拠のない最上級表現' },
  { re: /絶対|必ず[^ず]{0,4}(治|痩|儲|稼)|100%(保証|成功)/, label: '断定的な効果保証' },
  { re: /完治|治[るり]ます|効果があります|副作用[はが]あ?りません/, label: '医薬品的な効能表現' },
  { re: /誰でも(簡単に)?(稼|儲)/, label: '誇大な収益表現' },
]

export function findRiskyExpressions(copy: AdCopy): string[] {
  const all = `${copy.headline} ${copy.sub} ${copy.cta}`
  return RISKY_PATTERNS.filter((p) => p.re.test(all)).map((p) => p.label)
}

/** 上限を超えたら句読点・助詞の切れ目で削る。切れ目が無ければ単純に切る */
function shorten(s: string, limit: number): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (t.length <= limit) return t
  const cut = t.slice(0, limit)
  const boundary = Math.max(cut.lastIndexOf('、'), cut.lastIndexOf('。'), cut.lastIndexOf(' '))
  // 半分以上残るところで切れるならそこで切る。短すぎるくらいなら切り詰める
  return boundary > limit * 0.5 ? cut.slice(0, boundary) : cut
}

export function normalizeCopy(copy: AdCopy): AdCopy {
  return {
    headline: shorten(String(copy.headline || ''), COPY_LIMITS.headline),
    sub: shorten(String(copy.sub || ''), COPY_LIMITS.sub),
    cta: shorten(String(copy.cta || ''), COPY_LIMITS.cta),
  }
}

export interface GenerateCopyInput {
  brand: BrandProfile
  /** 訴求メモ（任意） */
  appeal?: string
  objective?: string
  count?: number
}

export async function generateConcepts(input: GenerateCopyInput): Promise<ConceptDraft[]> {
  const { brand, appeal, objective, count = 4 } = input

  const prompt = [
    'あなたは広告コピーライターです。以下のサービスについて、広告クリエイティブのコンセプトを作ってください。',
    '',
    '【最重要の制約: 文字数】',
    `- 大見出し（headline）: **全角${COPY_LIMITS.headline}字以内**`,
    `- サブコピー（sub）: **全角${COPY_LIMITS.sub}字以内**`,
    `- CTA（cta）: **全角${COPY_LIMITS.cta}字以内**`,
    '  この文字数は画像に直接描き込むための上限です。1字でも超えると使えません。',
    '  内容を盛り込むことより、短く言い切ることを優先してください。',
    '',
    '【その他の制約】',
    '- 根拠のない最上級表現（日本一・No.1・業界最安）は使わないでください。',
    '- 「必ず治る」「絶対に稼げる」のような断定的な効果保証は使わないでください。',
    '- CTAは行動を促す動詞で終える（例: 無料で試す / 資料をもらう / 今すぐ相談）。',
    '- 記号・絵文字は使わないでください（画像に描き込むと崩れます）。',
    '',
    `【作るコンセプト数】${count}件。訴求軸をそれぞれ変えてください。`,
    `使える訴求軸: ${Object.entries(APPEAL_LABELS).map(([k, v]) => `${k}(${v})`).join(' / ')}`,
    '',
    '【出力するJSONの形式】',
    '{ "concepts": [',
    '  { "label": "コンセプト名（例: ベネフィット訴求 × 信頼感）",',
    '    "appealAxis": "benefit",',
    '    "tone": "配色と雰囲気が想像できる短い言葉",',
    '    "copy": { "headline": "...", "sub": "...", "cta": "..." } }',
    '] }',
    '',
    `【サービス名】${brand.name}`,
    brand.description ? `【概要】${brand.description}` : '',
    brand.valueProps.length > 0 ? `【提供価値】${brand.valueProps.join(' / ')}` : '',
    brand.industry ? `【業種】${brand.industry}` : '',
    brand.tone ? `【ブランドの雰囲気】${brand.tone}` : '',
    objective ? `【広告の目的】${objective}` : '',
    appeal ? `【特に伝えたいこと】${appeal}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await geminiGenerateJson<{ concepts: ConceptDraft[] }>(
    { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
    'AdImageConcepts'
  )

  const valid = Object.keys(APPEAL_LABELS) as AppealAxis[]

  return (raw?.concepts || [])
    .filter((c) => c && c.copy && c.copy.headline)
    .slice(0, count)
    .map((c) => ({
      label: String(c.label || '').slice(0, 120) || 'コンセプト',
      appealAxis: valid.includes(c.appealAxis) ? c.appealAxis : 'benefit',
      tone: String(c.tone || brand.tone || '明るく信頼感がある').slice(0, 120),
      // モデルは文字数上限を破る。ここで必ず正規化する
      copy: normalizeCopy(c.copy),
    }))
    .filter((c) => c.copy.headline.length > 0 && c.copy.cta.length > 0)
}
