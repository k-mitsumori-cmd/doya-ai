// GET /api/home/summary — 経営ホームの再読み込み用（読むだけ）
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getHomeSummary } from '@/lib/home/summary'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const summary = await getHomeSummary(userId)
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[api/home/summary] failed', error)
    return NextResponse.json({ error: '集計に失敗しました。時間をおいて再度お試しください。' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
