// ============================================
// ドヤAIO クイックスタート補助
// 「サービスURL＋サービス名」だけから、AIで①カテゴリ ②監視プロンプト案 を生成する。
// 組織作成を意識させない“即・現状チェック”フローで使う。
// 失敗時は名前ベースの汎用プロンプトにフォールバックする（必ず何か返す）。
// ============================================
import dns from 'node:dns/promises'
import net from 'node:net'
import { geminiGenerateJson } from '@seo/lib/gemini'

// ---- SSRF対策: 内部/プライベート宛先へのサーバ側フェッチを防ぐ ----
// プライベート/ループバック/リンクローカル/メタデータ等のIPを弾く
function ipIsPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0 || a === 127 || a === 10) return true // 0.0.0.0/8, loopback, 10/8
    if (a === 169 && b === 254) return true // link-local（169.254.169.254 クラウドメタデータ含む）
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
    if (a === 192 && b === 168) return true // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64/10 CGNAT
    return false
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase().replace(/^\[|\]$/g, '')
    if (v === '::1' || v === '::') return true
    if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true // ULA / link-local
    const m = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/) // IPv4-mapped
    if (m) return ipIsPrivate(m[1])
    return false
  }
  return true // 解釈不能は安全側で拒否
}

// ホスト名が公開アドレスに解決されるか（内部名/プライベートIPは拒否）
async function hostIsPublic(hostname: string): Promise<boolean> {
  const h = hostname.toLowerCase().replace(/\.$/, '')
  if (!h || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return false
  if (net.isIP(h)) return !ipIsPrivate(h)
  try {
    const addrs = await dns.lookup(h, { all: true })
    return addrs.length > 0 && addrs.every((a) => !ipIsPrivate(a.address))
  } catch {
    return false
  }
}

// SSRF安全なHTML取得：スキームをhttp/sに限定し、各ホップでホストを再検証（リダイレクトは手動追従）
async function safeFetchHtml(startUrl: string, maxHops = 3): Promise<string> {
  let url = startUrl
  for (let hop = 0; hop <= maxHops; hop++) {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('unsupported scheme')
    if (!(await hostIsPublic(u.hostname))) throw new Error('blocked non-public host')
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; DoyaAIO/1.0; +https://doya-ai.surisuta.jp)' },
      redirect: 'manual',
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) break
      url = new URL(loc, url).toString() // 相対も解決し、次ループで再検証
      continue
    }
    if (!res.ok) throw new Error(`http ${res.status}`)
    return (await res.text()).slice(0, 30000)
  }
  throw new Error('too many redirects')
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
    // TLD（.co.jp / .com / .jp / .ai 等）を落として第2レベルラベルを取る
    const parts = host.split('.')
    const label = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
    const name = (label || host).replace(/[-_]+/g, ' ').trim()
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
export async function deriveBrandFromUrl(url: string): Promise<{ brandName: string; siteTitle?: string }> {
  const fallback = domainToBrandName(url)
  let title = ''
  try {
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

/**
 * サービス名＋URLから、AI可視性を測るための監視プロンプトとカテゴリを生成する。
 * - prompts: 一般ユーザーがAIに尋ねそうな「このサービスが登場しうる質問」。固有ブランド名は含めず汎用的に。
 * - category: 推定カテゴリ（例: マーケティングAI SaaS）。
 */
export async function suggestBrandSetup(input: { brandName: string; url?: string | null }): Promise<BrandSetupSuggestion> {
  const brandName = (input.brandName || '').trim()
  const url = (input.url || '').trim()
  if (!brandName) return { category: null, aliases: [], competitors: [], prompts: [] }

  const prompt = `あなたはAEO（AI可視性最適化）の専門家です。あるサービスについて、生成AI（ChatGPT等）での露出を測定するための情報を作ります。

# 対象サービス
名称: ${brandName}
URL: ${url || '(未入力)'}

# やること
1. このサービスのカテゴリを推定する（例:「マーケティングAI SaaS」「会計クラウド」など簡潔に）。
2. このサービス名の表記ゆれ・別名(aliases)を挙げる（カタカナ⇔英語表記、略称、スペースや記号の有無の違いなど）。無ければ空配列。
3. 同じカテゴリの主要な競合サービス名(competitors)を5〜8個、実在の固有名で挙げる（Share of Voice比較の対象になる。対象サービス自身は含めない）。
4. 一般ユーザーが生成AIに尋ねたときに、このサービスが“おすすめ候補として登場しうる”自然な日本語の質問を8つ作る。

# 質問の作り方（重要）
- 8問は**それぞれ異なる切り口**にする（用途・対象者・課題・予算・地域・比較軸・購入検討段階など）。似たような質問を並べない。広くカバーする。
- 例の切り口: 「初心者向け」「法人向け」「特定職種/業種向け」「無料・安いもの」「比較・ランキング」「特定の悩みの解決」「導入事例」「他社からの乗り換え」など、対象サービスの幅に合わせて分散させる。
- 質問文には固有のブランド名・企業名（対象サービス名も他社名も）を含めない。カテゴリの一般的な相談にする。
- 「おすすめは？」「比較したい」など、検索代わりにAIへ尋ねる体裁にする。

# 出力（JSONのみ）
{"category": string, "aliases": string[], "competitors": string[], "prompts": string[8]}`

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
    return {
      category: (typeof r?.category === 'string' && r.category.trim()) ? r.category.trim().slice(0, 120) : null,
      aliases,
      competitors,
      prompts: prompts.length ? prompts : fallbackPrompts(brandName),
    }
  } catch {
    return { category: null, aliases: [], competitors: [], prompts: fallbackPrompts(brandName) }
  }
}
