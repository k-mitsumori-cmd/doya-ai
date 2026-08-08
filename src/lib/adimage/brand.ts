// ============================================
// ドヤ広告画像AI ブランド抽出（URLクイックスタート）
// ============================================
// サービスURL1本で開始できることが体験の核。
// 抽出結果は必ず編集可能にする（AIの推測を押し付けない）。
import { safeFetchText, htmlToText } from '@/lib/net/safe-fetch'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import type { BrandProfile } from './types'

const MAX_CHARS = 14000

function absolute(base: URL, url: string): string | undefined {
  try {
    return new URL(url, base).toString()
  } catch {
    return undefined
  }
}

/** HTMLからブランドカラーの候補を拾う（CSS変数・theme-color・頻出のhex） */
function extractColors(html: string): string[] {
  const found = new Map<string, number>()

  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)
  if (theme?.[1]) found.set(theme[1].toLowerCase(), 1000)

  const re = /#([0-9a-fA-F]{6})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const hex = `#${m[1].toLowerCase()}`
    // 白・黒・グレーはブランドカラーとして意味を持たないので数えない
    const r = parseInt(m[1].slice(0, 2), 16)
    const g = parseInt(m[1].slice(2, 4), 16)
    const b = parseInt(m[1].slice(4, 6), 16)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max - min < 25) continue
    found.set(hex, (found.get(hex) || 0) + 1)
  }

  return Array.from(found.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hex]) => hex)
}

function extractLogo(html: string, base: URL): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (og?.[1]) return absolute(base, og[1])
  const icon = html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i)
  if (icon?.[1]) return absolute(base, icon[1])
  return undefined
}

export async function analyzeBrand(sourceUrl: string): Promise<BrandProfile> {
  const base = new URL(sourceUrl)
  const html = await safeFetchText(base.toString())
  if (!html) throw new Error('サイトを読み取れませんでした。URLをご確認ください。')

  const text = htmlToText(html).slice(0, MAX_CHARS)
  if (text.length < 150) throw new Error('サイトの内容を読み取れませんでした。URLをご確認ください。')

  const colors = extractColors(html)
  const logoUrl = extractLogo(html, base)

  const prompt = [
    'あなたは広告クリエイティブのディレクターです。',
    '以下のWebサイトの内容から、広告制作に使うブランド情報を抽出してください。',
    '',
    '【制約】',
    '- サイトに書かれていることだけから抽出してください。あなたの知識で補完しないでください。',
    '- tone は「明るく親しみやすい」「信頼感がありモダン」のように、配色と雰囲気が想像できる短い言葉にしてください。',
    '- valueProps は広告の見出しの素材になります。「何が嬉しいか」を短く3〜5件。',
    '',
    '【出力するJSONの形式】',
    '{',
    '  "name": "サービス名またはブランド名",',
    '  "description": "何のサービスか（100字程度）",',
    '  "valueProps": ["提供価値（各30字以内）"],',
    '  "industry": "業種",',
    '  "tone": "ブランドの雰囲気（30字以内）"',
    '}',
    '',
    '【サイトの内容】',
    text,
  ].join('\n')

  const raw = await geminiGenerateJson<BrandProfile>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT }, 'AdImageBrand')

  return {
    name: String(raw?.name || base.hostname).slice(0, 120),
    description: String(raw?.description || '').slice(0, 500) || undefined,
    valueProps: (raw?.valueProps || []).filter((s) => typeof s === 'string').slice(0, 8),
    // 抽出できた色が無ければブランドカラーを既定にする（配色指示が空だと生成が不安定になる）
    colors: colors.length > 0 ? colors : ['#0066ff'],
    industry: String(raw?.industry || '').slice(0, 60) || undefined,
    tone: String(raw?.tone || '').slice(0, 120) || undefined,
    logoUrl,
  }
}
