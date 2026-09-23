import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPersonaUsage } from '@/lib/persona/usage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401, headers })
    const usage = await getPersonaUsage(prisma, session.user.id)
    if (!usage) return NextResponse.json({ error: '再度ログインしてください。' }, { status: 401, headers })
    return NextResponse.json(usage, { headers })
  } catch {
    return NextResponse.json({ error: '利用状況を取得できませんでした。' }, { status: 503, headers })
  }
}
