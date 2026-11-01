export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/support?status=open — サポートチャットの受付の一覧（管理者だけ）
// ⚠️ 利用者の生の声とメールアドレスを返す。管理者認証の valid を必ず見る。
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { isMissingTable, isTicketStatus, TICKET_STATUSES } from '@/lib/support-chat/store'
import { SUPPORT_CATEGORY_LABEL, type SupportCategory } from '@/lib/support-chat/rules'

export async function GET(req: NextRequest) {
  const { valid } = await verifyAdminSession((await cookies()).get(COOKIE_NAME)?.value || null)
  if (!valid) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const status = new URL(req.url).searchParams.get('status')
  try {
    const [rows, counts] = await Promise.all([
      prisma.supportTicket.findMany({
        where: isTicketStatus(status) ? { status } : {},
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { user: { select: { email: true, name: true, plan: true } } },
      }),
      prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    ])
    return NextResponse.json({
      ready: true,
      counts: Object.fromEntries(TICKET_STATUSES.map((s) => [s, counts.find((c) => c.status === s)?._count._all ?? 0])),
      tickets: rows.map((t) => ({
        id: t.id,
        ticketNo: t.ticketNo,
        category: t.category,
        categoryLabel: SUPPORT_CATEGORY_LABEL[t.category as SupportCategory] ?? t.category,
        status: t.status,
        severity: t.severity,
        summary: t.summary.slice(0, 160),
        pagePath: t.pagePath,
        createdAt: t.createdAt.toISOString(),
        firstReplyAt: t.firstReplyAt?.toISOString() ?? null,
        user: t.user.name || t.user.email || '不明',
        plan: t.user.plan,
      })),
    })
  } catch (e) {
    // 表を本番に流す前は、受付は ServiceFeedback（ご意見の一覧）に残っている
    if (isMissingTable(e)) return NextResponse.json({ ready: false, counts: {}, tickets: [] })
    throw e
  }
}
