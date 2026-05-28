export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import QRCode from 'qrcode'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { generateSecret, getTotpUri } from '@/lib/totp'
import { prisma } from '@/lib/prisma'

// セットアップ用シークレット + QRコード生成（保存はまだしない）
export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid, adminUser } = await verifyAdminSession(token || null)
    if (!valid || !adminUser) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const secret = generateSecret()
    const label = adminUser.email || adminUser.username
    const uri = getTotpUri(secret, label)
    const qrDataUrl = await QRCode.toDataURL(uri)

    // シークレットを一時的に保存（totpEnabledはfalseのまま、検証後にtrueにする）
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { totpSecret: secret, totpEnabled: false },
    })

    return NextResponse.json({ secret, qrDataUrl })
  } catch (e) {
    console.error('[admin/2fa/setup]', e)
    return NextResponse.json({ error: 'セットアップに失敗しました' }, { status: 500 })
  }
}
