// ============================================
// サポートチャットの受付と履歴を保存・読む（support_ticket / support_message）
// ============================================
// ⚠️ 表が本番に入る前（P2021: 表が無い）に旗を on にしても動くよう、受付だけは ServiceFeedback に残す。
//    履歴と返信は表があるときだけ使える（無ければ空の一覧を返す）。
// ⚠️ 利用者の操作は、必ず userId でしぼる（他人の受付番号を指定しても読めない・書けない）。
import { prisma } from '@/lib/prisma'
import { redactPersonal, buildStoredText, type TicketInput } from './ticket'
import { severityOf, type SupportCategory } from './rules'
import type { SupportSource } from './knowledge'

export type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'closed'
export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'waiting_user', 'closed']
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: '未対応',
  in_progress: '対応中',
  waiting_user: 'お返事待ち',
  closed: '完了',
}

export function isTicketStatus(v: unknown): v is TicketStatus {
  return typeof v === 'string' && (TICKET_STATUSES as string[]).includes(v)
}

/** 表がまだ無い（本番に SQL を流す前） */
export function isMissingTable(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code
  const msg = String((e as { message?: string } | null)?.message ?? '')
  return code === 'P2021' || /support_(ticket|message).*does not exist/i.test(msg)
}

export type StoredTicket = { store: 'ticket' | 'feedback'; id: string }

/** 受付を保存する。表が無ければ ServiceFeedback に残す。どちらも失敗したら null */
export async function saveTicket(userId: string, input: TicketInput & { toolId: string | null }): Promise<StoredTicket | null> {
  const summary = redactPersonal(input.message).slice(0, 2000)
  try {
    const turns = input.transcript.slice(-10).map((t) => ({ role: t.role === 'user' ? 'user' : 'ai', body: redactPersonal(t.text).slice(0, 1000) }))
    const row = await prisma.supportTicket.create({
      data: {
        ticketNo: input.ticketNo,
        userId,
        category: input.category,
        severity: severityOf(input.category),
        toolId: input.toolId,
        pagePath: input.pagePath.split('?')[0].slice(0, 300),
        summary,
        env: {
          userAgent: input.env.userAgent ? redactPersonal(input.env.userAgent).slice(0, 300) : null,
          viewport: input.env.viewport ?? null,
          recentErrors: (input.env.recentErrors ?? []).slice(-5).map((e) => redactPersonal(e).slice(0, 300)),
        },
        contactOk: input.contactOk,
        messages: { create: [...turns, { role: 'user', body: summary }] },
      },
      select: { id: true },
    })
    return { store: 'ticket', id: row.id }
  } catch (e) {
    if (!isMissingTable(e)) console.error('[support-chat/store] saveTicket failed')
  }
  try {
    const row = await prisma.serviceFeedback.create({
      data: { userId, serviceId: 'support', text: buildStoredText(input), usageCount: 0 },
      select: { id: true },
    })
    return { store: 'feedback', id: row.id }
  } catch {
    console.error('[support-chat/store] fallback save failed')
    return null
  }
}

export type MyTicketSummary = {
  ticketNo: string
  category: SupportCategory
  status: TicketStatus
  summary: string
  createdAt: string
  unread: boolean
}

export function hasUnread(t: { lastStaffReplyAt: Date | null; userLastReadAt: Date | null }): boolean {
  if (!t.lastStaffReplyAt) return false
  return !t.userLastReadAt || t.userLastReadAt < t.lastStaffReplyAt
}

/** 本人の受付の一覧（新しい順に20件） */
export async function listMyTickets(userId: string): Promise<MyTicketSummary[]> {
  try {
    const rows = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { ticketNo: true, category: true, status: true, summary: true, createdAt: true, lastStaffReplyAt: true, userLastReadAt: true },
    })
    return rows.map((r) => ({
      ticketNo: r.ticketNo,
      category: r.category as SupportCategory,
      status: (isTicketStatus(r.status) ? r.status : 'open'),
      summary: r.summary.slice(0, 80),
      createdAt: r.createdAt.toISOString(),
      unread: hasUnread(r),
    }))
  } catch (e) {
    if (!isMissingTable(e)) console.error('[support-chat/store] listMyTickets failed')
    return []
  }
}

export type TicketMessageView = { role: 'user' | 'ai' | 'staff'; body: string; sources: SupportSource[]; createdAt: string }

export type MyTicketDetail = {
  ticketNo: string
  category: SupportCategory
  status: TicketStatus
  createdAt: string
  messages: TicketMessageView[]
}

function toMessageView(m: { role: string; body: string; sources: unknown; createdAt: Date }): TicketMessageView {
  const role = m.role === 'staff' || m.role === 'ai' ? m.role : 'user'
  const sources = Array.isArray(m.sources) ? (m.sources as SupportSource[]).filter((s) => s && typeof s.href === 'string' && s.href.startsWith('/')) : []
  return { role, body: m.body, sources, createdAt: m.createdAt.toISOString() }
}

/** 本人の受付を1件読み、既読にする。他人の受付・無い受付は null */
export async function readMyTicket(userId: string, ticketNo: string): Promise<MyTicketDetail | null> {
  try {
    const t = await prisma.supportTicket.findFirst({
      where: { ticketNo, userId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 100 } },
    })
    if (!t) return null
    if (hasUnread(t)) {
      await prisma.supportTicket.updateMany({ where: { id: t.id, userId }, data: { userLastReadAt: new Date() } }).catch(() => null)
    }
    return {
      ticketNo: t.ticketNo,
      category: t.category as SupportCategory,
      status: isTicketStatus(t.status) ? t.status : 'open',
      createdAt: t.createdAt.toISOString(),
      messages: t.messages.map(toMessageView),
    }
  } catch (e) {
    if (!isMissingTable(e)) console.error('[support-chat/store] readMyTicket failed')
    return null
  }
}

/** 本人が受付に追記する。完了・お返事待ちの受付は未対応に戻す。書けなければ null */
export async function addMyMessage(userId: string, ticketNo: string, body: string): Promise<{ id: string; category: SupportCategory } | null> {
  try {
    const t = await prisma.supportTicket.findFirst({ where: { ticketNo, userId }, select: { id: true, category: true } })
    if (!t) return null
    await prisma.$transaction([
      prisma.supportMessage.create({ data: { ticketId: t.id, role: 'user', body: redactPersonal(body).slice(0, 2000) } }),
      prisma.supportTicket.update({ where: { id: t.id }, data: { status: 'open', closedAt: null, userLastReadAt: new Date() } }),
    ])
    return { id: t.id, category: t.category as SupportCategory }
  } catch (e) {
    if (!isMissingTable(e)) console.error('[support-chat/store] addMyMessage failed')
    return null
  }
}

/** 返信の後の受付の状態（返信したら「お返事待ち」。完了にするときは明示する） */
export function statusAfterStaffReply(requested: unknown): TicketStatus {
  return requested === 'closed' ? 'closed' : 'waiting_user'
}
