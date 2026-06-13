export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOrCreateOrganization } from '@/lib/shodan/access'

// POST /api/shodan/organization — 組織を作成（初回オンボーディング）
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    let userId = (session?.user as any)?.id as string | undefined
    if (!userId && session?.user?.email) {
      const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      userId = u?.id
    }
    if (!userId) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const name = (body.name as string)?.trim()
    const memberName = (body.memberName as string)?.trim()
    if (!name || !memberName) {
      return NextResponse.json({ error: '組織名と氏名は必須です' }, { status: 400 })
    }

    const org = await getOrCreateOrganization(userId, name.slice(0, 120), memberName.slice(0, 80))
    return NextResponse.json({ organization: { id: org.id, name: org.name, slug: org.slug } })
  } catch (e: any) {
    console.error('[shodan/organization]', e?.message)
    return NextResponse.json({ error: '組織の作成に失敗しました' }, { status: 500 })
  }
}
