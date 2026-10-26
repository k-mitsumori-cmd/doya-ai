// ============================================
// サポートチャットの API の入力を読む（純粋な関数）
// ============================================
// ⚠️ 利用者から来る値は、型と長さをここで必ず切りそろえてから使う。
import type { ChatTurn } from './answer'
import { SUPPORT_CATEGORY_CHOICES, type SupportCategory } from './rules'
import type { TicketEnv } from './ticket'

export const ASK_MAX_CHARS = 500
export const TICKET_MAX_CHARS = 2000
/** 1人あたり1日の質問の上限 */
export const ASK_DAILY_LIMIT = 30
/** 1人あたり1日の「運営に伝える」の上限 */
export const TICKET_DAILY_LIMIT = 5
/** 全体での1日の有料 AI の上限（本物の AI に切り替えてから効く） */
export function aiDailyLimit(raw: string | undefined = process.env.SUPPORT_CHAT_AI_DAILY_LIMIT): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 800
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

export function parseHistory(v: unknown): ChatTurn[] {
  if (!Array.isArray(v)) return []
  const out: ChatTurn[] = []
  for (const t of v.slice(-10)) {
    if (!t || typeof t !== 'object') continue
    const role = (t as { role?: unknown }).role
    const text = str((t as { text?: unknown }).text, 1000).trim()
    if ((role === 'user' || role === 'assistant') && text) out.push({ role, text })
  }
  return out
}

export function parsePath(v: unknown): string {
  const p = str(v, 300)
  return p.startsWith('/') && !p.startsWith('//') ? p : '/'
}

export type AskBody = { question: string; history: ChatTurn[]; path: string }

export function parseAskBody(body: unknown): AskBody | { error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const raw = typeof b.question === 'string' ? b.question.trim() : ''
  if (!raw) return { error: '質問をご記入ください' }
  if (raw.length > ASK_MAX_CHARS) return { error: `質問は${ASK_MAX_CHARS}文字までにしてください` }
  return { question: raw, history: parseHistory(b.history), path: parsePath(b.path) }
}

export type TicketBody = {
  category: SupportCategory
  message: string
  transcript: ChatTurn[]
  path: string
  contactOk: boolean
  env: TicketEnv
}

export function parseTicketBody(body: unknown): TicketBody | { error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const category = SUPPORT_CATEGORY_CHOICES.find((c) => c === b.category)
  if (!category) return { error: 'お問い合わせの分類を選んでください' }
  const message = typeof b.message === 'string' ? b.message.trim() : ''
  if (!message) return { error: '内容をご記入ください' }
  if (message.length > TICKET_MAX_CHARS) return { error: `内容は${TICKET_MAX_CHARS}文字までにしてください` }
  const e = (b.env && typeof b.env === 'object' ? b.env : {}) as Record<string, unknown>
  const errs = Array.isArray(e.recentErrors) ? e.recentErrors.filter((x): x is string => typeof x === 'string').slice(-5).map((x) => x.slice(0, 300)) : []
  return {
    category,
    message,
    transcript: parseHistory(b.transcript),
    path: parsePath(b.path),
    contactOk: b.contactOk !== false,
    env: { userAgent: str(e.userAgent, 300), viewport: str(e.viewport, 20), url: str(e.url, 300), recentErrors: errs },
  }
}
