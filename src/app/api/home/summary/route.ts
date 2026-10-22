// GET /api/home/summary — 経営ホームの再読み込み用（読むだけ）
import type { NextRequest } from 'next/server'
import { privateApiJson } from '@/lib/private-api-response'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getHomeSummary, safeErrorInfo } from '@/lib/home/summary'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (typeof userId !== 'string' || !userId.trim()) return privateApiJson({ error: 'ログインが必要です' }, { status: 401 })
    const expectedActor = request.nextUrl.searchParams.get('expectedActor')
    if (!expectedActor || expectedActor !== userId) return privateApiJson({ error: 'ログイン状態を再確認してください。' }, { status: 409 })
    const summary = await getHomeSummary(userId)
    return privateApiJson(summary)
  } catch (caught) {
    console.error('[api/home/summary] failed', safeErrorInfo(caught))
    return privateApiJson({ error: '集計に失敗しました。時間をおいて再度お試しください。' }, { status: 500 })
  }
}
