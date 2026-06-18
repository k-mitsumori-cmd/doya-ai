// ============================================
// ドヤAIO 回答パーサー
// エンジンの回答本文を読み、自社ブランドの言及・順位・感情・登場した競合を構造化する。
// 引用URLはエンジンが直接返すため、ここでは扱わない。
// ============================================
import { geminiGenerateJson } from '@seo/lib/gemini'
import type { RunExtract, Sentiment } from './types'

export interface AnalyzeInput {
  answerText: string
  brandName: string
  aliases: string[]
  competitors: string[]
}

interface RawExtract {
  brandMentioned?: boolean
  brandRank?: number | null
  sentiment?: string | null
  competitorsMentioned?: string[]
}

/** 回答1件を構造化。LLM失敗時は素朴な文字列マッチにフォールバック。 */
export async function analyzeAnswer(input: AnalyzeInput): Promise<RunExtract> {
  const { answerText, brandName, aliases, competitors } = input
  const names = [brandName, ...aliases].filter(Boolean)

  // フォールバック用の素朴判定（LLMが落ちても最低限動く）
  const naiveMentioned = names.some((n) => n && answerText.toLowerCase().includes(n.toLowerCase()))

  if (!answerText.trim()) {
    return { brandMentioned: false, brandRank: null, sentiment: null, competitors: [], citations: [] }
  }

  const prompt = `あなたはAI検索の可視性アナリストです。下記の「AIの回答」を読み、追跡ブランドの登場状況を判定してください。

# 追跡ブランド
名称・別名: ${names.join(' / ') || '(未設定)'}

# 既知の競合（参考。回答に出た他社名はこれ以外も拾ってよい）
${competitors.join(' / ') || '(なし)'}

# AIの回答
"""
${answerText.slice(0, 4000)}
"""

# 出力（JSON）
- brandMentioned: 回答内に追跡ブランド（名称/別名）が登場するか true/false。表記ゆれも考慮する。
- brandRank: 回答が複数サービスを列挙している場合、追跡ブランドが何番目に出たか（1始まりの整数）。列挙でない/登場しないなら null。
- sentiment: 追跡ブランドへの論調。"positive" / "neutral" / "negative"。登場しないなら null。
- competitorsMentioned: 回答に登場した「追跡ブランド以外の」サービス名・ブランド名・企業名の配列（最大10件）。`

  try {
    const r = await geminiGenerateJson<RawExtract>({ prompt } as any)
    const sentiment = normalizeSentiment(r?.sentiment)
    const mentioned = typeof r?.brandMentioned === 'boolean' ? r.brandMentioned : naiveMentioned
    return {
      brandMentioned: mentioned,
      brandRank: mentioned && typeof r?.brandRank === 'number' && r.brandRank > 0 ? Math.floor(r.brandRank) : null,
      sentiment: mentioned ? sentiment : null,
      competitors: Array.isArray(r?.competitorsMentioned)
        ? r!.competitorsMentioned!.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).slice(0, 10)
        : [],
      citations: [],
    }
  } catch {
    return {
      brandMentioned: naiveMentioned,
      brandRank: null,
      sentiment: naiveMentioned ? 'neutral' : null,
      competitors: [],
      citations: [],
    }
  }
}

function normalizeSentiment(s: string | null | undefined): Sentiment {
  const v = (s || '').toLowerCase()
  if (v.startsWith('pos')) return 'positive'
  if (v.startsWith('neg')) return 'negative'
  return 'neutral'
}
