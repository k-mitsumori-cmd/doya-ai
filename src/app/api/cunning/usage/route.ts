export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/cunning/access'
import { getCunningUsage } from '@/lib/cunning/limits'
import { betaServiceDenied } from '@/lib/beta-service.server'

// GET /api/cunning/usage — プラン・当月利用時間・ナレッジ数
export async function GET() {
  // 開発中のベータ版（services.ts の hidden: 'beta'）。許可した人のほかは、ここで 403
  const betaDenied = await betaServiceDenied('cunning')
  if (betaDenied) return betaDenied
  try {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ plan: 'GUEST' }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  }
  const usage = await getCunningUsage(userId)
  return NextResponse.json(
    { plan: usage.tier, ...usage },
    { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } }
  )
  } catch {
    console.error('[cunning/usage] lookup failed')
    return NextResponse.json({ error: '利用状況を確認できませんでした。再試行してください。' }, { status: 503, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  }
}
