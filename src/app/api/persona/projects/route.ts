import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listPersonaProjects, parsePersonaHistoryCursor } from '@/lib/persona/project-history'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401, headers })
    let cursor: ReturnType<typeof parsePersonaHistoryCursor>
    try { cursor = parsePersonaHistoryCursor(new URL(req.url).searchParams.get('cursor')) }
    catch { return NextResponse.json({ error: '履歴の続き情報が無効です。一覧を再読み込みしてください。' }, { status: 400, headers }) }
    return NextResponse.json(await listPersonaProjects(prisma, session.user.id, cursor), { headers })
  } catch {
    return NextResponse.json({ error: '履歴を取得できませんでした。再度お試しください。' }, { status: 503, headers })
  }
}
