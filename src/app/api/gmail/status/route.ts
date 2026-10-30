export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isEncryptionConfigured } from '@/lib/gmail/crypto'
import { GMAIL_DAILY_LIMIT, getTodaySendCount } from '@/lib/gmail/send'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const conn = await prisma.gmailConnection.findUnique({
    where: { userId },
    select: { email: true, status: true, connectedAt: true, revokedAt: true },
  })
  return NextResponse.json({
    configured: isEncryptionConfigured() && Boolean(process.env.GOOGLE_CLIENT_ID),
    connection: conn,
    dailyLimit: GMAIL_DAILY_LIMIT,
    sentToday: conn ? await getTodaySendCount(userId) : 0,
  })
}
