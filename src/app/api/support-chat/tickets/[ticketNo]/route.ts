export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GET  /api/support-chat/tickets/[ticketNo] — 本人の受付のやり取りを読む（既読にする）
// POST /api/support-chat/tickets/[ticketNo] — 本人が受付に追記する（Slack に知らせる）
// 旗 SUPPORT_CHAT_ROLLOUT の内側（off なら 404）。⚠️ 受付は userId でしぼる（他人の受付番号では読めない）。
import { NextRequest, NextResponse } from 'next/server'
import { postToSlackBlocks } from '@/lib/notifications'
import { isSupportChatEnabled } from '@/lib/support-chat/flag'
import { addMyMessage, readMyTicket } from '@/lib/support-chat/store'
import { supportUserId } from '@/lib/support-chat/session'
import { buildFollowUpSlack } from '@/lib/support-chat/ticket'
import { TICKET_MAX_CHARS, TICKET_DAILY_LIMIT } from '@/lib/support-chat/request'
import { consumeDailyQuota, quotaSubject } from '@/lib/server-daily-quota'

type Ctx = { params: Promise<{ ticketNo: string }> | { ticketNo: string } }

async function ticketNoOf(ctx: Ctx): Promise<string | null> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const no = decodeURIComponent(p.ticketNo || '')
  return /^DY-\d{6}-[2-9A-HJ-NP-Z]{4}$/.test(no) ? no : null
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await isSupportChatEnabled())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const userId = await supportUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const no = await ticketNoOf(ctx)
  const ticket = no ? await readMyTicket(userId, no) : null
  if (!ticket) return NextResponse.json({ error: 'お問い合わせが見つかりません' }, { status: 404 })
  return NextResponse.json({ ticket })
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!(await isSupportChatEnabled())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const userId = await supportUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const no = await ticketNoOf(ctx)
  if (!no) return NextResponse.json({ error: 'お問い合わせが見つかりません' }, { status: 404 })
  const body = await req.json().catch(() => null)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ error: '内容をご記入ください' }, { status: 400 })
  if (message.length > TICKET_MAX_CHARS) return NextResponse.json({ error: `内容は${TICKET_MAX_CHARS}文字までにしてください` }, { status: 400 })

  // 追記も「運営に伝える」と同じ1日の上限で数える（数えられないときは受け付ける）
  const quota = await consumeDailyQuota('support-chat-ticket', quotaSubject(userId), TICKET_DAILY_LIMIT * 2)
  if (quota === 'limited') return NextResponse.json({ error: '今日お送りいただける回数に達しました。明日あらためてお送りください。', limited: true }, { status: 429 })

  const saved = await addMyMessage(userId, no, message)
  if (!saved) return NextResponse.json({ error: 'お問い合わせが見つかりません' }, { status: 404 })

  const slack = buildFollowUpSlack({ ticketNo: no, category: saved.category, message })
  await postToSlackBlocks(slack.title, [{ type: 'section', text: { type: 'mrkdwn', text: slack.text.slice(0, 2900) } }], undefined, slack.meta)
    .catch(() => console.error('[api/support-chat/tickets] slack failed'))
  const ticket = await readMyTicket(userId, no)
  return NextResponse.json({ ok: true, ticket })
}
