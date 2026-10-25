export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST /api/support-chat/ticket — 「運営に伝える」を受け付けて、Slack に送る
// 旗 SUPPORT_CHAT_ROLLOUT の内側（off なら 404）。ログインした人だけ。
// 保存は support_ticket / support_message（表が無いあいだは ServiceFeedback の serviceId 'support'。store.ts）。
// Slack の送り先は、今のドヤAIの通知と同じ SystemSetting の slack_webhook（postToSlackBlocks）。新しい送り先は作らない。
// ⚠️ Slack が失敗しても、保存は巻き戻さない。黙らずにアラートの経路へ回す（/api/feedback と同じ考え方）。
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { postToSlackBlocks } from '@/lib/notifications'
import { notifyAlert } from '@/lib/alert'
import { getAccountCompanyName } from '@/lib/shell/company.server'
import { isSupportChatEnabled } from '@/lib/support-chat/flag'
import { toolLabel } from '@/lib/support-chat/answer'
import { toolIdForPath } from '@/lib/support-chat/knowledge'
import { parseTicketBody, TICKET_DAILY_LIMIT } from '@/lib/support-chat/request'
import { buildTicketSlack, isBusinessHours, makeTicketNo, replyEtaText } from '@/lib/support-chat/ticket'
import { saveTicket } from '@/lib/support-chat/store'
import { consumeDailyQuota, quotaSubject } from '@/lib/server-daily-quota'

export async function POST(req: NextRequest) {
  if (!(await isSupportChatEnabled())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const session = await getServerSession(authOptions)
  const email = session?.user?.email ?? null
  let userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId && email) userId = (await prisma.user.findUnique({ where: { email }, select: { id: true } }).catch(() => null))?.id
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const parsed = parseTicketBody(await req.json().catch(() => null))
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // 1人あたり1日の上限。数えられないとき（DB の障害）は受け付ける（クレームを取りこぼさない）
  const quota = await consumeDailyQuota('support-chat-ticket', quotaSubject(userId), TICKET_DAILY_LIMIT)
  if (quota === 'limited') {
    return NextResponse.json({ error: `今日お送りいただける回数（${TICKET_DAILY_LIMIT}回）に達しました。続きは、受付番号を添えてメールでお知らせください。`, limited: true }, { status: 429 })
  }

  const [user, company] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }).catch(() => null),
    getAccountCompanyName().catch(() => null),
  ])
  const ticketNo = makeTicketNo()
  const toolId = toolIdForPath(parsed.path)
  const input = {
    ticketNo,
    category: parsed.category,
    message: parsed.message,
    transcript: parsed.transcript,
    toolLabel: toolLabel(toolId),
    pagePath: parsed.path,
    companyName: company?.name ?? null,
    plan: user?.plan ?? null,
    userEmail: email,
    contactOk: parsed.contactOk,
    env: parsed.env,
  }

  const saved = await saveTicket(userId, { ...input, toolId })

  const slack = buildTicketSlack(input)
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: slack.text.slice(0, 2900) } }]
  let notified = false
  for (let attempt = 0; attempt < 2 && !notified; attempt++) {
    try {
      await postToSlackBlocks(slack.title, blocks, undefined, slack.meta)
      notified = true
    } catch {
      console.error('[api/support-chat/ticket] slack failed')
    }
  }
  if (!notified || !saved) {
    await notifyAlert({
      level: 'critical',
      kind: 'inquiry',
      title: !saved ? 'サポートチャットのお問い合わせを保存できませんでした' : 'サポートチャットのお問い合わせを Slack に送れませんでした',
      context: `受付番号 ${ticketNo}${saved ? `（${saved.store === 'ticket' ? 'support_ticket' : 'ServiceFeedback'} id: ${saved.id}）` : '（保存なし。内容は下の本文だけ）'}`,
      detail: slack.text.slice(0, 2500),
      dedupKey: `support-ticket-failed:${ticketNo}`,
    }).catch(() => false)
  }
  if (!saved && !notified) {
    return NextResponse.json({ error: 'お問い合わせを受け付けられませんでした。時間をおいてもう一度お試しください。' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ticketNo, replyEta: replyEtaText(parsed.category), businessHours: isBusinessHours(), history: saved?.store === 'ticket' })
}
