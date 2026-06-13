export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listMemberships } from '@/lib/shodan/access'

// GET /api/shodan/me — 入口/サイドバー用。認証・オンボーディング状態・所属組織を返す。
// ※Cookie認証なのでクライアントの useSession status に依存せず呼べる。
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  let userId = (session?.user as any)?.id as string | undefined
  if (!userId && session?.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    userId = u?.id
  }
  if (!userId) {
    return NextResponse.json({ authenticated: false, onboarded: false, memberships: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const memberships = await listMemberships()
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, name: true } })
  return NextResponse.json(
    {
      authenticated: true,
      onboarded: memberships.length > 0,
      memberships,
      plan: user?.plan || 'FREE',
      name: user?.name || null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
