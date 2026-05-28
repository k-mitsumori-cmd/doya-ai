export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { verifyToken } from '@/lib/totp'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(COOKIE_NAME)?.value
    const { valid, adminUser } = await verifyAdminSession(sessionToken || null)
    if (!valid || !adminUser) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { token: totpToken } = await req.json()
    const user = await prisma.adminUser.findUnique({
      where: { id: adminUser.id },
      select: { totpSecret: true, totpEnabled: true },
    })
    if (!user?.totpEnabled || !user?.totpSecret) {
      return NextResponse.json({ error: '2FA は有効になっていません' }, { status: 400 })
    }

    // 無効化時にも確認コードを要求（不正な無効化を防ぐ）
    if (!verifyToken(user.totpSecret, totpToken)) {
      return NextResponse.json({ error: '認証コードが正しくありません' }, { status: 400 })
    }

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { totpSecret: null, totpEnabled: false },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[admin/2fa/disable]', e)
    return NextResponse.json({ error: '無効化に失敗しました' }, { status: 500 })
  }
}
