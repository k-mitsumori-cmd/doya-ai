export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isGmailEnabled } from '@/lib/gmail/crypto'
import { GMAIL_DAILY_LIMIT, getTodaySendCount } from '@/lib/gmail/send'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  if (!isGmailEnabled()) {
    return NextResponse.json({ configured: false, connection: null, dailyLimit: GMAIL_DAILY_LIMIT, sentToday: 0 })
  }
  try {
    const conn = await prisma.gmailConnection.findUnique({
      where: { userId },
      select: { email: true, status: true, connectedAt: true, revokedAt: true },
    })
    return NextResponse.json({
      configured: true,
      connection: conn,
      dailyLimit: GMAIL_DAILY_LIMIT,
      sentToday: conn ? await getTodaySendCount(userId) : 0,
    })
  } catch {
    // 表がまだ無い場合など。画面は「準備中」の表示になる
    return NextResponse.json({ configured: false, connection: null, dailyLimit: GMAIL_DAILY_LIMIT, sentToday: 0 })
  }
}
