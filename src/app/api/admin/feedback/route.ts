export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/feedback — 集まった改善点・要望の一覧
// ⚠️ 利用者の生の声。管理者認証を必ず通すこと。
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { serviceLabelOf } from '@/lib/attribution'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const admin = token ? await verifyAdminSession(token) : null
  if (!admin) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const serviceId = new URL(req.url).searchParams.get('service') || undefined

  const rows = await prisma.serviceFeedback.findMany({
    where: serviceId ? { serviceId } : {},
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: { user: { select: { email: true, name: true, plan: true } } },
  })

  // サービス別の件数と平均満足度（どこに手を入れるべきかの当たりを付ける）
  const byService = await prisma.serviceFeedback.groupBy({
    by: ['serviceId'],
    _count: { _all: true },
    _avg: { rating: true },
  })

  return NextResponse.json({
    feedback: rows.map((r) => ({
      id: r.id,
      serviceId: r.serviceId,
      serviceLabel: serviceLabelOf(r.serviceId),
      rating: r.rating,
      text: r.text,
      usageCount: r.usageCount,
      createdAt: r.createdAt,
      user: r.user?.name || r.user?.email || '不明',
      plan: r.user?.plan || 'FREE',
    })),
    byService: byService
      .map((b) => ({
        serviceId: b.serviceId,
        serviceLabel: serviceLabelOf(b.serviceId),
        count: b._count._all,
        avgRating: b._avg.rating ? Math.round(b._avg.rating * 10) / 10 : null,
      }))
      .sort((a, b) => b.count - a.count),
  })
}
