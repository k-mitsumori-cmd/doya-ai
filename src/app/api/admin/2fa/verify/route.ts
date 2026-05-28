export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { verifyToken } from '@/lib/totp'
import { prisma } from '@/lib/prisma'

// セットアップ時の検証 + 有効化
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(COOKIE_NAME)?.value
    const { valid, adminUser } = await verifyAdminSession(sessionToken || null)
    if (!valid || !adminUser) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { token: totpToken } = await req.json()
    if (!totpToken) return NextResponse.json({ error: 'コードを入力してください' }, { status: 400 })

    const user = await prisma.adminUser.findUnique({
      where: { id: adminUser.id },
      select: { totpSecret: true },
    })
    if (!user?.totpSecret) {
      return NextResponse.json({ error: 'セットアップが必要です' }, { status: 400 })
    }

    if (!verifyToken(user.totpSecret, totpToken)) {
      return NextResponse.json({ error: '認証コードが正しくありません' }, { status: 400 })
    }

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { totpEnabled: true },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[admin/2fa/verify]', e)
    return NextResponse.json({ error: '検証に失敗しました' }, { status: 500 })
  }
}
