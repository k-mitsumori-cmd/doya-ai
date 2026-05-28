export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid, adminUser } = await verifyAdminSession(token || null)
    if (!valid || !adminUser) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const user = await prisma.adminUser.findUnique({
      where: { id: adminUser.id },
      select: { totpEnabled: true },
    })

    return NextResponse.json({
      enabled: user?.totpEnabled || false,
      username: adminUser.username,
      email: adminUser.email,
    })
  } catch (e) {
    console.error('[admin/2fa/status]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
