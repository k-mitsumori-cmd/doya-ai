export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/support-chat/tickets — 本人の受付の一覧（運営の返信の未読の印つき）
// 旗 SUPPORT_CHAT_ROLLOUT の内側（off なら 404）。表が無いあいだは空の一覧。
import { NextResponse } from 'next/server'
import { isSupportChatEnabled } from '@/lib/support-chat/flag'
import { listMyTickets } from '@/lib/support-chat/store'
import { supportUserId } from '@/lib/support-chat/session'

export async function GET() {
  if (!(await isSupportChatEnabled())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const userId = await supportUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const tickets = await listMyTickets(userId)
  return NextResponse.json({ tickets, unread: tickets.filter((t) => t.unread).length })
}
