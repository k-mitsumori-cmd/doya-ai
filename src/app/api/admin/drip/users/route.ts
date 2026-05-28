import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { getPlanLabel } from '@/lib/admin/plans'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: ドリップ配信対象ユーザー一覧
export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        firstLoginAt: true,
        createdAt: true,
        sessions: {
          select: { expires: true },
          orderBy: { expires: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            dripEnrollments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const now = Date.now()
    const dormantThreshold = 30 * 24 * 60 * 60 * 1000 // 30日
    // NextAuthのセッションexpiresは「セッションの有効期限」だが、
    // セッション作成時にexpires=now+30日として記録されるため、
    // 最新セッションのexpiresが現在+α なら「最近ログインした」とみなせる
    const SESSION_LIFETIME = 30 * 24 * 60 * 60 * 1000

    const result = users.map(u => {
      const latestSession = u.sessions[0]
      // セッションがあれば最終ログイン推定: expires - SESSION_LIFETIME
      const estimatedLastLogin = latestSession
        ? new Date(latestSession.expires).getTime() - SESSION_LIFETIME
        : (u.firstLoginAt ? new Date(u.firstLoginAt).getTime() : null)
      const isDormant = !estimatedLastLogin || (now - estimatedLastLogin) > dormantThreshold
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        plan: u.plan || 'FREE',
        planLabel: getPlanLabel(u.plan),
        status: isDormant ? 'dormant' : 'active',
        lastLogin: estimatedLastLogin ? new Date(estimatedLastLogin).toISOString() : null,
        enrollmentsCount: u._count.dripEnrollments,
      }
    })

    return NextResponse.json({ users: result })
  } catch (error) {
    console.error('[Drip] Users list error:', error)
    return NextResponse.json({ error: 'ユーザーの取得に失敗しました' }, { status: 500 })
  }
}
