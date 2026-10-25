export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GET  /api/admin/support/[id] — 受付1件とやり取り（管理者だけ）
// POST /api/admin/support/[id] — 運営の返信と状態の変更 { reply?, status?, sendEmail? }
//   返信は support_message（role staff）に残し、お客さまが返信を希望していればメールでも送る（Resend）。
// ⚠️ 管理者認証の valid を必ず見る。メールの送信に失敗しても返信は残す（画面からは読める）。
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { isTicketStatus, statusAfterStaffReply } from '@/lib/support-chat/store'
import { buildReplyEmail } from '@/lib/support-chat/mail'
import { SUPPORT_CATEGORY_LABEL, type SupportCategory } from '@/lib/support-chat/rules'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function admin() {
  const r = await verifyAdminSession((await cookies()).get(COOKIE_NAME)?.value || null)
  return r.valid ? r.adminUser ?? null : null
}

async function load(id: string) {
  const t = await prisma.supportTicket.findUnique({
    where: { id },
    include: { user: { select: { email: true, name: true, plan: true } }, messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
  })
  if (!t) return null
  return {
    id: t.id,
    ticketNo: t.ticketNo,
    category: t.category,
    categoryLabel: SUPPORT_CATEGORY_LABEL[t.category as SupportCategory] ?? t.category,
    status: t.status,
    severity: t.severity,
    toolId: t.toolId,
    pagePath: t.pagePath,
    env: t.env,
    contactOk: t.contactOk,
    createdAt: t.createdAt.toISOString(),
    user: { email: t.user.email, name: t.user.name, plan: t.user.plan },
    messages: t.messages.map((m) => ({ id: m.id, role: m.role, body: m.body, authorEmail: m.authorEmail, emailedAt: m.emailedAt?.toISOString() ?? null, createdAt: m.createdAt.toISOString() })),
  }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await admin())) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  const { id } = 'then' in ctx.params ? await ctx.params : ctx.params
  const ticket = await load(id)
  if (!ticket) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  return NextResponse.json({ ticket })
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const me = await admin()
  if (!me) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  const { id } = 'then' in ctx.params ? await ctx.params : ctx.params
  const body = await req.json().catch(() => ({}))
  const reply = typeof body?.reply === 'string' ? body.reply.trim().slice(0, 4000) : ''
  const t = await prisma.supportTicket.findUnique({ where: { id }, include: { user: { select: { email: true, name: true } } } })
  if (!t) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  let mail: 'sent' | 'skipped' | 'failed' = 'skipped'
  if (reply) {
    const now = new Date()
    const status = statusAfterStaffReply(body?.status)
    const msg = await prisma.supportMessage.create({ data: { ticketId: t.id, role: 'staff', body: reply, authorEmail: me.email ?? me.username } })
    await prisma.supportTicket.update({
      where: { id: t.id },
      data: { status, firstReplyAt: t.firstReplyAt ?? now, lastStaffReplyAt: now, closedAt: status === 'closed' ? now : null, assigneeEmail: t.assigneeEmail ?? me.email ?? me.username },
    })
    if (body?.sendEmail !== false && t.contactOk && t.user.email) {
      const { subject, html } = buildReplyEmail({ ticketNo: t.ticketNo, userName: t.user.name, reply })
      const r = await sendEmail({ to: t.user.email, subject, html, tags: [{ name: 'type', value: 'support_reply' }] }).catch(() => ({ success: false }))
      mail = r.success ? 'sent' : 'failed'
      if (r.success) await prisma.supportMessage.update({ where: { id: msg.id }, data: { emailedAt: new Date() } }).catch(() => null)
    }
  } else if (isTicketStatus(body?.status)) {
    await prisma.supportTicket.update({ where: { id: t.id }, data: { status: body.status, closedAt: body.status === 'closed' ? new Date() : null } })
  } else {
    return NextResponse.json({ error: '返信か状態を指定してください' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, mail, ticket: await load(t.id) })
}
