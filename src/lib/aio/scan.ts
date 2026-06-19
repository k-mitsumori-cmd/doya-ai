// ============================================
// ドヤAIO スキャン中核
// プロンプト × エンジン × 反復回 を実行 → 回答を構造化 → 集計（認知度/SoV/引用/感情）
// → 改善アクションを生成。DB非依存の純ロジック（API側で永続化する）。
// ============================================
import { geminiGenerateJson } from '@seo/lib/gemini'
import { askEngine, serperSearch, domainOf } from './engines'
import { analyzeAnswer } from './analyze'
import type {
  EngineId,
  RunExtract,
  ScanSummary,
  Recommendation,
  CitationChannel,
} from './types'

export interface ScanBrand {
  brandName: string
  brandUrl?: string | null
  aliases: string[]
  competitors: string[]
  category?: string | null
}

export interface ScanPromptInput {
  id: string
  text: string
}

export interface ScanRunRow extends RunExtract {
  promptId: string
  engine: EngineId
  iteration: number
  answerText: string
}

export interface ScanOutput {
  runs: ScanRunRow[]
  summary: ScanSummary
  recommendations: Recommendation[]
}

// ---- 簡易並列プール ----
async function pMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return out
}

/**
 * スキャンを実行して集計まで返す。
 * mode='search'（既定）: chatgpt/gemini/claude にもWeb検索結果を注入し「検索付きAI」を再現（実際のChatGPT等の挙動に近い）。
 * mode='memory': 検索を注入せず、学習データのみで回答させる（AIの記憶での見え方）。
 */
export async function executeScan(
  brand: ScanBrand,
  prompts: ScanPromptInput[],
  engines: EngineId[],
  repetitions: number,
  mode: 'search' | 'memory' = 'search'
): Promise<ScanOutput> {
  // 0) プロンプトごとに1回だけWeb検索（グラウンディング＆引用元分析で共用）
  const hitsList = await pMap(prompts, 4, (p) => serperSearch(p.text, 8))
  const hitsByPrompt = new Map<string, typeof hitsList[number]>()
  prompts.forEach((p, i) => hitsByPrompt.set(p.id, hitsList[i] || []))

  // 1) 全ラン（プロンプト×エンジン×反復）を組み立て
  type Job = { prompt: ScanPromptInput; engine: EngineId; iteration: number }
  const jobs: Job[] = []
  for (const p of prompts) {
    for (const e of engines) {
      for (let it = 0; it < repetitions; it++) jobs.push({ prompt: p, engine: e, iteration: it })
    }
  }

  // 2) 実行＋構造化（同時実行は6まで）
  const runs = await pMap(jobs, 6, async (job): Promise<ScanRunRow> => {
    try {
      const groundingHits = mode === 'search' ? hitsByPrompt.get(job.prompt.id) : undefined
      const ans = await askEngine(job.engine, job.prompt.text, { groundingHits })
      const ext = await analyzeAnswer({
        answerText: ans.text,
        brandName: brand.brandName,
        aliases: brand.aliases,
        competitors: brand.competitors,
      })
      return {
        promptId: job.prompt.id,
        engine: job.engine,
        iteration: job.iteration,
        ...ext,
        citations: ans.citations, // エンジンが参照した引用URL（検索注入分 or Perplexityネイティブ）
        answerText: ans.text.slice(0, 2000),
      }
    } catch (e: any) {
      // 1ラン失敗は欠測扱い（言及なし）。スキャン全体は止めない。
      return {
        promptId: job.prompt.id,
        engine: job.engine,
        iteration: job.iteration,
        brandMentioned: false,
        brandRank: null,
        sentiment: null,
        competitors: [],
        citations: [],
        answerText: '',
      }
    }
  })

  const summary = aggregate(brand, prompts, engines, runs)
  // 競合名の名寄せ（表記ゆれ・ドメイン↔社名を統合）→ SoVを再計算
  summary.sov = await canonicalizeSov(summary.sov, brand)
  summary.shareOfVoice = summary.sov.find((s) => s.isOwn)?.pct ?? summary.shareOfVoice
  const recommendations = await buildRecommendations(brand, summary)
  return { runs, summary, recommendations }
}

/**
 * SoVの表記ゆれを統合する。"マイナビProfessional" と "professional.mynavi.jp" のような
 * 同一サービスの別表記を1つにまとめる。LLMで正規化し、失敗時は決定的な正規化にフォールバック。
 */
async function canonicalizeSov(
  sov: ScanSummary['sov'],
  brand: ScanBrand
): Promise<ScanSummary['sov']> {
  if (sov.length <= 1) return sov
  const total = sov.reduce((a, b) => a + b.mentions, 0) || 1

  // --- LLMで正規化グループを得る ---
  try {
    const list = sov.map((s) => `${s.brand} (${s.mentions})`).join('\n')
    const prompt = `次は「AIの回答に登場したサービス/ブランド名と出現回数」のリストです。同一サービスの表記ゆれ（日本語名/英語名/ドメイン/社名）を1つに統合してください。

# 追跡対象（この表記を正とする）
${brand.brandName}（別名: ${brand.aliases.join(' / ') || 'なし'}）

# リスト
${list}

# 出力（JSON）
{ "groups": [ { "canonical": "代表名", "variants": ["元リストの表記", ...] } ] }
- canonical は最も一般的な正式名（追跡対象は必ず "${brand.brandName}"）。
- 1つしか表記が無いものも variants 1件のグループにする。元リストの表記は漏れなくどこかのグループに入れる。`
    const r = await geminiGenerateJson<{ groups: { canonical: string; variants: string[] }[] }>({ prompt } as any)
    const groups = r?.groups
    if (Array.isArray(groups) && groups.length) {
      const byVariant = new Map<string, string>()
      for (const g of groups) for (const v of g.variants || []) byVariant.set(v, g.canonical)
      const merged = new Map<string, number>()
      for (const s of sov) {
        const canon = byVariant.get(s.brand) || s.brand
        merged.set(canon, (merged.get(canon) || 0) + s.mentions)
      }
      return finalizeSov(merged, total, brand.brandName)
    }
  } catch {
    /* fallthrough to deterministic */
  }

  // --- 決定的フォールバック（同言語の表記ゆれだけ統合） ---
  const merged = new Map<string, number>()
  const keyToName = new Map<string, string>()
  for (const s of sov) {
    const k = normKey(s.brand)
    if (!keyToName.has(k)) keyToName.set(k, s.brand)
    merged.set(k, (merged.get(k) || 0) + s.mentions)
  }
  const named = new Map<string, number>()
  for (const [k, v] of merged) named.set(keyToName.get(k) || k, v)
  return finalizeSov(named, total, brand.brandName)
}

function finalizeSov(merged: Map<string, number>, total: number, ownName: string): ScanSummary['sov'] {
  const ownKey = normKey(ownName)
  return Array.from(merged.entries())
    .map(([brand, mentions]) => ({
      brand,
      mentions,
      pct: round1((mentions / total) * 100),
      isOwn: normKey(brand) === ownKey,
    }))
    .sort((a, b) => b.mentions - a.mentions)
}

function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/https?:\/\//, '')
    .replace(/株式会社|（株）|\(株\)|有限会社|inc\.?|ltd\.?|co\.,?|corporation/g, '')
    .replace(/\.(co\.jp|com|jp|work|net|io|ai|biz).*$/, '')
    .replace(/[\s.\-_/]/g, '')
}

// ---- 集計 ----
function aggregate(
  brand: ScanBrand,
  prompts: ScanPromptInput[],
  engines: EngineId[],
  runs: ScanRunRow[]
): ScanSummary {
  const totalRuns = runs.length
  const brandRuns = runs.filter((r) => r.brandMentioned).length
  const awarenessPct = totalRuns ? round1((brandRuns / totalRuns) * 100) : 0

  // エンジン別認知度
  const perEngine = engines.map((engine) => {
    const er = runs.filter((r) => r.engine === engine)
    const m = er.filter((r) => r.brandMentioned).length
    return { engine, awarenessPct: er.length ? round1((m / er.length) * 100) : 0 }
  })

  // Share of Voice の母数（HubSpot式）:
  //  競合が登録されていれば「自社＋登録競合だけ」を母数にする（数値が集中し比較しやすい）。
  //  登録が無ければ従来どおり「検出した全ブランド」を母数にフォールバック。
  const tracked = brand.competitors || []
  const counts = new Map<string, number>()
  const ownKey = brand.brandName
  counts.set(ownKey, brandRuns)
  if (tracked.length > 0) {
    for (const c of tracked) counts.set(c, 0)
    for (const r of runs) {
      for (const name of r.competitors) {
        const key = matchCompetitor(name, tracked) // 登録競合にマッチした分だけ算入（非登録ブランドは母数に含めない）
        if (key) counts.set(key, (counts.get(key) || 0) + 1)
      }
    }
  } else {
    for (const r of runs) {
      for (const name of r.competitors) {
        const key = matchCompetitor(name, tracked) || name
        counts.set(key, (counts.get(key) || 0) + 1)
      }
    }
  }
  const totalMentions = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1
  const sov = Array.from(counts.entries())
    .map(([brandName, mentions]) => ({
      brand: brandName,
      mentions,
      pct: round1((mentions / totalMentions) * 100),
      isOwn: brandName === ownKey,
    }))
    .filter((s) => s.mentions > 0 || s.isOwn)
    .sort((a, b) => b.mentions - a.mentions)
  const shareOfVoice = sov.find((s) => s.isOwn)?.pct ?? 0

  // 感情分布（言及ありのランのみ）
  const mentionedRuns = runs.filter((r) => r.brandMentioned)
  const sentiment = {
    positive: pct(mentionedRuns.filter((r) => r.sentiment === 'positive').length, mentionedRuns.length),
    neutral: pct(mentionedRuns.filter((r) => r.sentiment === 'neutral').length, mentionedRuns.length),
    negative: pct(mentionedRuns.filter((r) => r.sentiment === 'negative').length, mentionedRuns.length),
  }

  // 引用元ドメイン（エンジン引用 + Serperグラウンディング）
  const ownDomain = brand.brandUrl ? domainOf(brand.brandUrl) : null
  const domainCount = new Map<string, number>()
  for (const r of runs) for (const u of r.citations) {
    const d = domainOf(u)
    if (d) domainCount.set(d, (domainCount.get(d) || 0) + 1)
  }
  const totalCitations = Array.from(domainCount.values()).reduce((a, b) => a + b, 0)
  const ownCit = ownDomain ? domainCount.get(ownDomain) || 0 : 0
  const ownCitationPct = totalCitations ? round1((ownCit / totalCitations) * 100) : 0
  const citations = Array.from(domainCount.entries())
    .map(([domain, count]) => ({
      domain,
      count,
      isOwn: !!ownDomain && domain === ownDomain,
      channel: classifyChannel(domain, ownDomain, brand.competitors) as CitationChannel,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // プロンプト別 × エンジン別の言及頻度
  const promptBreakdown = prompts.map((p) => {
    const samples: { engine: EngineId; answer: string; brandMentioned: boolean; competitors: string[] }[] = []
    for (const engine of engines) {
      const er = runs.filter((r) => r.promptId === p.id && r.engine === engine)
      // 代表回答: 自社言及あり優先 → 競合が出ているもの → 先頭
      const pick = er.find((r) => r.brandMentioned) || er.find((r) => (r.competitors || []).length > 0) || er[0]
      if (pick && (pick.answerText || '').trim()) {
        samples.push({
          engine,
          answer: (pick.answerText || '').slice(0, 700),
          brandMentioned: pick.brandMentioned,
          competitors: (pick.competitors || []).slice(0, 12),
        })
      }
    }
    return {
      promptId: p.id,
      text: p.text,
      perEngine: engines.map((engine) => {
        const er = runs.filter((r) => r.promptId === p.id && r.engine === engine)
        return { engine, mentioned: er.filter((r) => r.brandMentioned).length, total: er.length }
      }),
      samples,
    }
  })

  return {
    totalRuns,
    brandRuns,
    awarenessPct,
    shareOfVoice,
    sentiment,
    ownCitationPct,
    perEngine,
    sov,
    citations,
    promptBreakdown,
  }
}

// 比較・おすすめ系の媒体に多いドメインパターン
const MEDIA_PATTERN =
  /(magazine|media|blog|column|note\.com|hatena|ameblo|news|journal|guide|matome|hikaku|ranking|osusume|review|connect|lab|marketing|career|hr-|recruit)/
// 検索結果でよく出る大手プラットフォーム/求人媒体（メディア扱い）
const KNOWN_MEDIA = new Set([
  'indeed.com', 'jp.indeed.com', 'mynavi.jp', 'professional.mynavi.jp', 'doda.jp', 'en-japan.com',
  'my-best.com', 'it-trend.jp', 'kigyolog.com', 'aspicjapan.org', 'boxil.jp', 'strate.biz',
])

function asciiToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function classifyChannel(domain: string, ownDomain: string | null, competitors: string[]): CitationChannel {
  if (ownDomain && domain === ownDomain) return 'own'
  // 競合のオウンドメディア判定：競合名のASCIIトークンがドメインに含まれるか（例: 競合名→そのブランドのドメイン）
  const dt = asciiToken(domain)
  for (const c of competitors) {
    const t = asciiToken(c)
    if (t.length >= 4 && dt.includes(t)) return 'competitor'
  }
  if (KNOWN_MEDIA.has(domain) || MEDIA_PATTERN.test(domain)) return 'media'
  return 'other'
}

function matchCompetitor(name: string, competitors: string[]): string | null {
  const n = name.toLowerCase().trim()
  if (!n) return null
  for (const c of competitors) {
    const cl = c.toLowerCase().trim()
    if (!cl) continue
    if (cl === n) return c
    // 短い名称(3文字以下)は誤マッチ(例:"PR"→"PR TIMES")を防ぐため完全一致のみ採用
    if (cl.length <= 3 || n.length <= 3) continue
    if (n.includes(cl) || cl.includes(n)) return c
  }
  return null
}

const round1 = (n: number) => Math.round(n * 10) / 10
const pct = (a: number, b: number) => (b ? round1((a / b) * 100) : 0)

// ---- 改善アクション生成 ----
async function buildRecommendations(brand: ScanBrand, summary: ScanSummary): Promise<Recommendation[]> {
  const topCitations = summary.citations.slice(0, 5).map((c) => `${c.domain}(${c.count})`).join(', ')
  const weakPrompts = summary.promptBreakdown
    .filter((p) => p.perEngine.every((e) => e.mentioned === 0))
    .map((p) => p.text)
    .slice(0, 5)

  const prompt = `あなたはAEO（AI検索最適化）コンサルタントです。下記のスキャン結果をもとに、このブランドがAIの回答に引用・言及されるための改善アクションを3〜5個、具体的に提案してください。

# ブランド
${brand.brandName}（${brand.category || ''}） サイト: ${brand.brandUrl || '不明'}

# 現状
- AI認知度（言及率）: ${summary.awarenessPct}%
- Share of Voice: ${summary.shareOfVoice}%
- 自社ドメイン引用率: ${summary.ownCitationPct}%
- AIがよく引用するドメイン: ${topCitations || 'なし'}
- まったく言及されないプロンプト: ${weakPrompts.join(' / ') || 'なし'}

# 出力（JSON）
{ "recommendations": [ { "title": "...", "detail": "...", "priority": "high|medium|low" } ] }
detail は実行可能な施策で、引用元メディアへの掲載・自社サイトのAI可読化(構造化データ/llms.txt/クローラ許可)・比較コンテンツ作成などに触れること。`

  try {
    const r = await geminiGenerateJson<{ recommendations: Recommendation[] }>({ prompt } as any)
    const recs = Array.isArray(r?.recommendations) ? r.recommendations : []
    if (recs.length) return recs.slice(0, 5).map(normalizeRec)
  } catch {
    /* fallthrough */
  }
  // フォールバック（ルールベース）
  return [
    {
      title: 'AIの引用元メディアへの掲載を獲得する',
      detail: `AIの回答の根拠は比較メディアが中心（${topCitations || '比較記事'}）。これらの「おすすめ◯◯」記事への掲載・寄稿を進める。`,
      priority: 'high',
    },
    {
      title: '自社サイトをAI可読にする',
      detail: '料金・機能・FAQをschema.orgで構造化し、llms.txtを設置、robots.txtでGPTBot/PerplexityBot/Google-Extendedを許可する。',
      priority: summary.ownCitationPct < 10 ? 'high' : 'medium',
    },
    {
      title: '言及されないプロンプト向けの比較コンテンツを作る',
      detail: `不在のテーマ（${weakPrompts.join(' / ') || '弱点クエリ'}）に対し、比較フォーマットの記事を自社で用意してAIに引用されやすくする。`,
      priority: 'medium',
    },
  ]
}

function normalizeRec(r: Recommendation): Recommendation {
  const p = (r.priority || '').toLowerCase()
  return {
    title: String(r.title || '改善施策').slice(0, 120),
    detail: String(r.detail || '').slice(0, 600),
    priority: p === 'high' || p === 'low' ? (p as any) : 'medium',
  }
}
