import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

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

    const result = users.map(u => {
      const lastLogin = u.firstLoginAt ? new Date(u.firstLoginAt).getTime() : null
      const isDormant = !lastLogin || (now - lastLogin) > dormantThreshold
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        plan: u.plan || 'FREE',
        status: isDormant ? 'dormant' : 'active',
        lastLogin: u.firstLoginAt,
        enrollmentsCount: u._count.dripEnrollments,
      }
    })

    return NextResponse.json({ users: result })
  } catch (error) {
    console.error('[Drip] Users list error:', error)
    return NextResponse.json({ error: 'ユーザーの取得に失敗しました' }, { status: 500 })
  }
}
