// ============================================
// ドヤAIO エンジンアダプタ
// 監視プロンプトを各AIエンジンに投げ、回答本文＋（取れれば）引用URLを返す。
// - chatgpt   : OpenAI Chat Completions (gpt-4o)
// - gemini    : @seo/lib/gemini ラッパー
// - claude    : Anthropic Messages API (raw fetch)
// - perplexity: api.perplexity.ai（検索グラウンディング・引用URLが標準で返る）
// 引用元（上位ドメイン）分析用に Serper のWeb検索も提供する。
// ============================================
import OpenAI from 'openai'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import type { EngineId } from './types'

export interface EngineAnswer {
  text: string
  citations: string[] // 引用URL（取れたものだけ）
}

export interface AskOptions {
  groundingHits?: SerperHit[] // 検索ありモード: 注入するWeb検索結果（chatgpt/gemini/claude用）
}

const SYSTEM = 'あなたは役立つアシスタントです。質問に日本語で簡潔に答えてください。サービス名・ブランド名・企業名は具体的に挙げてください。'

// 検索結果を回答の根拠として注入するブロック（実際の検索付きAIの挙動を再現）
function groundedPrompt(prompt: string, hits?: SerperHit[]): { content: string; citations: string[] } {
  if (!hits || hits.length === 0) return { content: prompt, citations: [] }
  const top = hits.slice(0, 8)
  const block = top.map((h, i) => `[${i + 1}] ${h.title}（${h.domain}）\n${h.snippet || ''}`).join('\n')
  const content = `あなたはWeb検索結果を要約して答える検索アシスタントです。以下の検索結果【のみ】を根拠に質問へ回答してください。

# ルール
- 検索結果に登場する具体的なサービス名・ブランド名・企業名を必ず挙げて列挙する（最低3つ）。
- 一般論や検索結果に無い知識で答えない。検索結果に出てくる固有名詞を優先する。
- 箇条書きで「サービス名：特徴」の形で答える。

# 検索結果
${block}

# 質問
${prompt}`
  return { content, citations: top.map((h) => h.link) }
}

let _openai: OpenAI | null = null
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

const CLAUDE_MODEL = process.env.AIO_CLAUDE_MODEL || 'claude-sonnet-4-6'

/** プロンプトを1エンジンに1回投げる。失敗時は例外（呼び出し元で個別ハンドリング）。 */
export async function askEngine(engine: EngineId, prompt: string, opts?: AskOptions): Promise<EngineAnswer> {
  // chatgpt/gemini/claude は検索結果を注入して「検索付きAI」を再現（perplexityは元々検索付き）
  const g = engine === 'perplexity' ? { content: prompt, citations: [] } : groundedPrompt(prompt, opts?.groundingHits)
  switch (engine) {
    case 'chatgpt': {
      const r = await openai().chat.completions.create({
        model: process.env.AIO_OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: g.content },
        ],
        temperature: 0.8,
        max_tokens: 700,
      })
      return { text: r.choices[0]?.message?.content || '', citations: g.citations }
    }
    case 'gemini': {
      const text = await geminiGenerateText({
        model: GEMINI_TEXT_MODEL_DEFAULT,
        parts: [{ text: `${SYSTEM}\n\n${g.content}` }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 700 },
      } as any)
      return { text: text || '', citations: g.citations }
    }
    case 'claude': {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 700,
          temperature: 0.8,
          system: SYSTEM,
          messages: [{ role: 'user', content: g.content }],
        }),
      })
      if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`)
      const data = await res.json()
      return { text: data.content?.[0]?.text || '', citations: g.citations }
    }
    case 'perplexity': {
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: process.env.AIO_PERPLEXITY_MODEL || 'sonar',
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 700,
        }),
      })
      if (!res.ok) throw new Error(`Perplexity API ${res.status}: ${await res.text()}`)
      const data = await res.json()
      const text: string = data.choices?.[0]?.message?.content || ''
      // Perplexity は citations / search_results にURL配列を返す（バージョン差を吸収）
      const citations: string[] = Array.isArray(data.citations)
        ? data.citations.filter((u: any) => typeof u === 'string')
        : Array.isArray(data.search_results)
          ? data.search_results.map((s: any) => s?.url).filter((u: any) => typeof u === 'string')
          : []
      return { text, citations }
    }
    default:
      throw new Error(`未対応エンジン: ${engine}`)
  }
}

// ---- Serper（Google検索API）: 引用元ドメイン分析のグラウンディング用 ----
export interface SerperHit {
  title: string
  link: string
  domain: string
  snippet: string
}

/** プロンプト相当の検索クエリで上位URLを取得（引用元候補）。キー無ければ空配列。 */
export async function serperSearch(query: string, num = 10): Promise<SerperHit[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) return []
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'jp', hl: 'ja', num }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const organic: any[] = Array.isArray(data.organic) ? data.organic : []
    return organic
      .map((o) => {
        const link = o?.link as string
        if (!link) return null
        let domain = ''
        try {
          domain = new URL(link).hostname.replace(/^www\./, '')
        } catch {
          return null
        }
        return { title: o?.title || '', link, domain, snippet: o?.snippet || '' }
      })
      .filter(Boolean) as SerperHit[]
  } catch {
    return []
  }
}

export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
