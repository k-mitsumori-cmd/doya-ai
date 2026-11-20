// ============================================
// ドヤAIO クイックスタート補助
// 「サービスURL＋サービス名」だけから、AIで①カテゴリ ②監視プロンプト案 を生成する。
// 組織作成を意識させない“即・現状チェック”フローで使う。
// 失敗時は名前ベースの汎用プロンプトにフォールバックする（必ず何か返す）。
// ============================================
import { getDomainWithoutSuffix } from 'tldts'
import { domainToUnicode } from 'node:url'
import { geminiGenerateJson } from '@seo/lib/gemini'
import { safeFetchText } from '@/lib/net/safe-fetch'
import { profileToPromptBlock, UNKNOWN, type ServiceProfile } from '@/lib/aio/service-profile'
import type { PageSignals } from '@/lib/aio/site-reader'

// The shared fetcher pins the validated IP across each hop and bounds the
// decompressed HTML before we inspect its title.
async function safeFetchHtml(url: string): Promise<string> {
  const html = await safeFetchText(url, { timeoutMs: 24_000, maxBytes: 2 * 1024 * 1024, maxRedirects: 3 })
  if (html === null) throw new Error('site fetch failed')
  return html.slice(0, 30000)
}

// URLにスキームが無ければ https:// を前置して正規化（無効なら null）
export function normalizeUrl(raw: string): string | null {
  const t = (raw || '').trim()
  if (!t) return null
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

// ドメイン名から決定的にブランド名を作る（フォールバック）。例: doya-ai.surisuta.jp → surisuta
export function domainToBrandName(url: string): string {
  try {
    let host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    // 既知の汎用サブドメインを除去
    host = host.replace(/^(app|service|portal|my|go|get|web|www2)\./, '')
    // Resolve public/private suffixes instead of treating co/com as the brand.
    const label = getDomainWithoutSuffix(host, { allowPrivateDomains: true }) || host
    const name = domainToUnicode(label).replace(/[-_]+/g, ' ').trim()
    return name ? name.slice(0, 60) : host.slice(0, 60)
  } catch {
    return (url || '').replace(/^https?:\/\//, '').slice(0, 60)
  }
}

// 軽いHTMLエンティティデコード（タイトル整形用）
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)) } catch { return '' } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)) } catch { return '' } })
    .trim()
}

/**
 * URLからブランド/サービス名を推定する。
 * 1) ドメイン名から決定的なフォールバックを用意（必ず何か返す）
 * 2) サイトHTMLを取得し og:site_name / <title> を抽出
 * 3) Geminiで「サフィックス等を除いた短いサービス名」に整形
 * 失敗時は全てフォールバック値に落ちる（quick-start を止めない）。
 */
export async function deriveBrandFromUrl(url: string, topPage?: Pick<PageSignals, 'siteName' | 'title'> | null): Promise<{ brandName: string; siteTitle?: string }> {
  const fallback = domainToBrandName(url)
  let title = ''
  if (topPage) title = decodeEntities(topPage.siteName || topPage.title || '')
  else try {
    // SSRF対策済みの安全フェッチ（内部/プライベート宛先・非http(s)・危険なリダイレクトを拒否）
    const html = await safeFetchHtml(url)
    const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)
    const tt = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    title = decodeEntities(og?.[1] || tt?.[1] || '')
  } catch {
    /* フェッチ拒否/失敗 → ドメイン名フォールバック */
  }

  if (!title) return { brandName: fallback }

  // タイトルから区切り前の主要チャンクを取り出すフォールバック
  const chunk = title.split(/[｜|\-–—:：]/)[0]?.trim() || title
  try {
    const prompt = `次のWebページのタイトルから、サービス名・ブランド名だけを短く1つ抽出してください。「公式サイト」「｜会社名」「- 説明」等の付随語は除く。日本語ならそのまま。\n\nタイトル: ${title}\nドメイン由来の候補: ${fallback}\n\n出力はJSONのみ: {"brandName": string}`
    const r = await geminiGenerateJson<{ brandName?: string }>({ prompt } as any)
    const name = typeof r?.brandName === 'string' ? r.brandName.trim() : ''
    if (name) return { brandName: name.slice(0, 120), siteTitle: title }
  } catch {
    /* LLM失敗 → chunk へ */
  }
  return { brandName: (chunk || fallback).slice(0, 120), siteTitle: title }
}

export interface BrandSetupSuggestion {
  category: string | null
  aliases: string[]
  competitors: string[]
  prompts: string[]
}

// LLM失敗時の汎用フォールバック（サービス名を差し込むだけ。固有の他社名は出さない）
function fallbackPrompts(brandName: string): string[] {
  const n = brandName.trim() || 'このサービス'
  return [
    `${n}のようなサービスでおすすめはどれ？`,
    `${n}と似たサービスを比較したい。主な選択肢を教えて`,
    `初心者・中小企業向けに${n}の分野でおすすめは？`,
    `${n}の分野で人気・定番のサービスは？`,
    `${n}の分野で信頼できるサービスはどれ？`,
  ]
}

export function buildSuggestPrompt(input: { brandName: string; url: string; profile: ServiceProfile | null; siteContext: string | null }): string {
  const { brandName, url, profile, siteContext } = input
  return `あなたはAEO（AI可視性最適化）の専門家です。あるサービスについて、生成AI（ChatGPT等）での露出を測定するための情報を作ります。

# 対象サービス
名称: ${brandName}
URL: ${url || '(未入力)'}

# 読み取ったサービスの内容（これが唯一の事実の根拠）
${profile ? profileToPromptBlock(profile) : '(読み取れていません)'}
${siteContext ? `\n# サイトから読み取った文章（抜粋）\n${siteContext.slice(0, 4000)}\n` : ''}
# 最重要ルール
- サービス名・URLの文字や語感から、サービスの内容を推測してはいけない。業種・対象の客・用途は、上の「読み取ったサービスの内容」と「読み取った文章」に書かれたことだけを使う。
- 「${UNKNOWN}」の項目は、質問や競合の根拠にしない。
- 読み取った内容が、営業・CRM・SaaS など別の分野に見えても、書かれていなければ使わない。

# やること
1. このサービスのカテゴリを、読み取った業種から簡潔に答える（例:「人材紹介会社向けの面談設定代行」）。業種が「${UNKNOWN}」なら null。
2. このサービス名の表記ゆれ・別名(aliases)を挙げる（カタカナ⇔英語表記、略称、スペースや記号の有無の違いなど）。無ければ空配列。
3. 競合サービス名(competitors)を、読み取った業種・競合の種類に合う実在の固有名だけで挙げる（最大8個）。確信できる物だけにし、無理に埋めない。業種が「${UNKNOWN}」なら空配列。対象サービス自身は含めない。
4. 読み取った対象の客が、生成AIに尋ねそうな自然な日本語の質問を8つ作る。

# 質問の作り方
- 8問は**それぞれ異なる切り口**にする（課題・対象者・業種・予算・比較軸・検討段階など）。似た質問を並べない。
- 質問文には固有のブランド名・企業名（対象サービス名も他社名も）を含めない。
- 質問は、読み取った「何のサービスか」「誰向けか」の範囲に収める。別の分野の質問を作らない。
- 「おすすめは？」「比較したい」など、検索代わりにAIへ尋ねる体裁にする。

# 出力（JSONのみ）
{"category": string|null, "aliases": string[], "competitors": string[], "prompts": string[8]}`
}

/**
 * サービス名＋URLから、AI可視性を測るための監視プロンプトとカテゴリを生成する。
 * - prompts: 一般ユーザーがAIに尋ねそうな「このサービスが登場しうる質問」。固有ブランド名は含めず汎用的に。
 * - category: 推定カテゴリ（例: マーケティングAI SaaS）。
 */
export async function suggestBrandSetup(input: { brandName: string; url?: string | null; profile?: ServiceProfile | null; siteContext?: string | null }): Promise<BrandSetupSuggestion> {
  const brandName = (input.brandName || '').trim()
  const url = (input.url || '').trim()
  if (!brandName) return { category: null, aliases: [], competitors: [], prompts: [] }
  const prompt = buildSuggestPrompt({ brandName, url, profile: input.profile ?? null, siteContext: input.siteContext ?? null })

  try {
    const r = await geminiGenerateJson<{ category?: string; aliases?: string[]; competitors?: string[]; prompts?: string[] }>({ prompt } as any)
    const prompts = Array.isArray(r?.prompts)
      ? r!.prompts!.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).slice(0, 8)
      : []
    const aliases = Array.isArray(r?.aliases)
      ? r!.aliases!.filter((s) => typeof s === 'string' && s.trim() && s.trim() !== brandName).map((s) => s.trim()).slice(0, 8)
      : []
    const competitors = Array.isArray(r?.competitors)
      ? r!.competitors!.filter((s) => typeof s === 'string' && s.trim() && s.trim() !== brandName).map((s) => s.trim()).slice(0, 8)
      : []
    // 読み取った内容がある場合、名前だけの汎用質問に黙って切り替えない（誤った質問を作らず、失敗として扱う）
    if (!prompts.length && input.profile) throw new Error('prompt generation returned no prompts')
    return {
      category: (typeof r?.category === 'string' && r.category.trim()) ? r.category.trim().slice(0, 120) : null,
      aliases,
      competitors,
      prompts: prompts.length ? prompts : fallbackPrompts(brandName),
    }
  } catch (error) {
    if (input.profile) throw error
    return { category: null, aliases: [], competitors: [], prompts: fallbackPrompts(brandName) }
  }
}
