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
/** 1つのテキストから色を数える（HTMLでもCSSでも使う） */
function countColors(text: string, found: Map<string, number>, weight = 1): void {
  const push = (r: number, g: number, b: number, w: number) => {
    // 白・黒・グレーはブランドカラーとして意味を持たないので数えない
    if (Math.max(r, g, b) - Math.min(r, g, b) < 25) return
    const hex = `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`
    found.set(hex, (found.get(hex) || 0) + w)
  }

  // #rrggbb
  const re6 = /#([0-9a-fA-F]{6})\b/g
  let m: RegExpExecArray | null
  while ((m = re6.exec(text)) !== null) {
    const h = m[1]
    push(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), weight)
  }

  // ⚠️ #abc の短縮形も拾う。CSSでは珍しくなく、これを見ないと取りこぼす
  const re3 = /#([0-9a-fA-F]{3})\b/g
  while ((m = re3.exec(text)) !== null) {
    const h = m[1]
    push(parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), weight)
  }

  // ⚠️ rgb()/rgba() も拾う。最近のサイトはこちらで書くことが多い
  const reRgb = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g
  while ((m = reRgb.exec(text)) !== null) {
    push(Number(m[1]), Number(m[2]), Number(m[3]), weight)
  }
}

/**
 * ブランドカラーを読み取る。
 *
 * ⚠️ **HTMLだけを見てはいけない。** 最近のサイトは色をすべて外部CSSに置いており、
 *    HTML本文に色が1つも書かれていないことがある。実測: carryme.jp のHTMLには
 *    hex/rgb が0件で、色は外部CSS4本の中にあった。
 *    その結果、抽出が0件になり既定色（#0066ff＝こちらのブランド色）に落ちて、
 *    他社サイトを読んでもドヤAIの青が使われていた（2026-09-02）。
 */
async function extractColors(html: string, base: URL): Promise<string[]> {
  const found = new Map<string, number>()

  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)
  if (theme?.[1]) {
    // theme-color はサイトが自分で宣言した代表色。最優先で扱う
    countColors(theme[1], found, 1000)
  }

  // インラインの style / style属性 を含むHTML本文
  countColors(html, found, 3)

  // 外部CSS。⚠️ 数が多いと遅くなるので先頭4本まで、各200KBまで
  const links = Array.from(html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi))
    .filter((m) => /stylesheet/i.test(m[0]))
    .map((m) => m[1])
    .slice(0, 4)
  await Promise.all(
    links.map(async (href) => {
      try {
        const url = new URL(href, base).toString()
        // ⚠️ accept を渡さないと safe-fetch が content-type で弾き、CSSは必ず null になる
        //    （safe-fetch.ts:147 は accept 未指定だと html 以外を捨てる）。
        //    これに気づかず、外部CSSを読む実装を入れても色が0件のままだった。
        const css = await safeFetchText(url, { accept: 'text/css,*/*' })
        if (css) countColors(css.slice(0, 200_000), found, 1)
      } catch {
        // 読めないCSSは飛ばす。1本落ちても他から取れる
      }
    })
  )

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

  const colors = await extractColors(html, base)
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
