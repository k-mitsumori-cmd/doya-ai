// ============================================
// サポートチャットの答えを作る
// ============================================
// 本物の AI は gemini.ts（gemini-2.5-flash。2026-10-26 ユーザー承認）。モックはテストと、AI が使えないときの代わりに残す。
// SUPPORT_CHAT_AI=mock で、いつでもモックに戻せる。キーが無いときもモック。
// ⚠️ どの答え方でも、最後に answerNeedsStaff() を通す。材料に無い話は「分からない」で返す。
import { knowledgeEntries, toolNameOf, type KnowledgeEntry, type SupportSource } from './knowledge'
import { answerNeedsStaff, routeQuestion, SUPPORT_CATEGORY_LABEL, type SupportCategory } from './rules'
import { createGeminiAnswerer, geminiApiKey } from './gemini'

export type ChatTurn = { role: 'user' | 'assistant'; text: string }

export type SupportAnswer =
  /** 材料から答えられた */
  | { kind: 'answer'; text: string; sources: SupportSource[]; matchedId: string }
  /** 材料に無い。無理に答えず、運営に伝える案内を出す */
  | { kind: 'unknown'; text: string; sources: SupportSource[] }
  /** 運営が必ず対応する分類 */
  | { kind: 'staff'; text: string; sources: SupportSource[]; category: SupportCategory }

export type AnswerInput = { question: string; history: ChatTurn[]; toolId: string | null }

export interface SupportAnswerer {
  readonly name: string
  /** 有料の API を呼ぶか（呼ぶものは、全体の1日の上限を数える） */
  readonly paid: boolean
  answer(input: AnswerInput): Promise<SupportAnswer>
}

const UNKNOWN_TEXT = 'この内容には、AIではお答えできません。運営の担当者からお答えしますので、「運営に伝える」からお知らせください。'

function norm(s: string): string {
  return (s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '')
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
  return out
}

// 「教えて」「ください」のような、どの質問にも入る言葉は数えない
const STOP = new Set(['教え', 'えて', 'くだ', 'ださ', 'さい', 'です', 'すか', 'ます', 'すが', 'して', 'たい', 'につ', 'つい', 'いて', 'とは', 'は何', '何で', 'でき', 'きま', 'ける', 'のは', 'って', 'たら', 'すれ', 'れば', 'ばい', 'いい', 'よい', 'いで', 'のか'])

/** 材料ごとの点数。言葉が当たれば大きく、2文字のかたまりの重なりは小さく数える */
export function scoreEntry(entry: KnowledgeEntry, question: string, toolId: string | null): number {
  const q = norm(question)
  if (!q) return 0
  let score = 0
  for (const k of entry.keywords) if (k && q.includes(norm(k))) score += 10 + norm(k).length
  const qb = bigrams(q)
  const tb = bigrams(norm(`${entry.title}${entry.keywords.join('')}`))
  for (const b of qb) if (!STOP.has(b) && tb.has(b)) score += 1
  // 今開いているツールの質問は、そのツールの材料を少し優先する（「使い方」だけの質問など）
  if (toolId && entry.toolId === toolId && score > 0) score += 4
  if (toolId && entry.toolId === toolId && /(使い方|何ができ|なにができ|使えます|始め方|はじめ方)/.test(q)) score += 8
  return score
}

/** これより低い点数は「分からない」とする */
export const MIN_SCORE = 6

/** モック: 材料の中から一番合うものを返す。外には何も送らない */
export const mockAnswerer: SupportAnswerer = {
  name: 'mock',
  paid: false,
  async answer({ question, toolId }) {
    const routed = routeQuestion(question)
    if (routed.route === 'staff') {
      return { kind: 'staff', category: routed.category, text: staffText(routed.category), sources: [] }
    }
    const ranked = knowledgeEntries()
      .map((e) => ({ e, s: scoreEntry(e, question, toolId) }))
      .sort((a, b) => b.s - a.s)
    const top = ranked[0]
    if (!top || top.s < MIN_SCORE) {
      return { kind: 'unknown', text: UNKNOWN_TEXT, sources: [] }
    }
    return { kind: 'answer', text: top.e.body, sources: [top.e.source], matchedId: top.e.id }
  },
}

export function staffText(category: SupportCategory): string {
  const label = SUPPORT_CATEGORY_LABEL[category]
  if (category === 'security') {
    return `${label}のおそれがあるため、すぐに運営の担当者へお伝えします。下の「運営に伝える」から、分かる範囲で状況をお書きください。パスワードやカードの番号は書かないでください。`
  }
  return `${label}のご相談は、運営の担当者がお答えします。下の「運営に伝える」から、状況をお書きください。`
}

/** 今使う答え方。SUPPORT_CHAT_AI=mock かキーが無ければモック、それ以外は Gemini */
export function getSupportAnswerer(mode: string | undefined = process.env.SUPPORT_CHAT_AI, key: string = geminiApiKey()): SupportAnswerer {
  if ((mode ?? '').trim().toLowerCase() === 'mock' || !key) return mockAnswerer
  return createGeminiAnswerer({ apiKey: key })
}

/**
 * 答えを作り、最後に安全の確かめをかける（答え方が本物の AI でも、この関数を通す）。
 * 根拠のリンクの無い答えは、出さずに「分からない」にする。
 */
export async function answerQuestion(answerer: SupportAnswerer, input: AnswerInput): Promise<SupportAnswer> {
  const routed = routeQuestion(input.question)
  if (routed.route === 'staff') {
    return { kind: 'staff', category: routed.category, text: staffText(routed.category), sources: [] }
  }
  const history = input.history.slice(-6)
  let res: SupportAnswer
  try {
    res = await answerer.answer({ ...input, history })
  } catch {
    // 本物の AI が使えない（障害・上限・キーの不備）ときは、モックで答える。モックが失敗したら呼び出し元へ
    if (answerer === mockAnswerer) throw new Error('mock answer failed')
    console.error('[support-chat] AI answer failed, using mock')
    res = await mockAnswerer.answer({ ...input, history })
  }
  if (res.kind === 'staff') return { ...res, text: res.text || staffText(res.category), sources: [] }
  if (res.kind !== 'answer') return res
  const needs = answerNeedsStaff(res.text)
  if (needs) return { kind: 'staff', category: needs, text: staffText(needs), sources: [] }
  if (!res.sources.length) return { kind: 'unknown', text: UNKNOWN_TEXT, sources: [] }
  return res
}

/** 運営への要約に使う、今のツールの名前（無ければ「ツールの外」） */
export function toolLabel(toolId: string | null): string {
  return toolNameOf(toolId) ?? 'ツールの外（ホームなど）'
}
