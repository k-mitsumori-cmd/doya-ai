export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/cunning/access'
import { getCunningUsage } from '@/lib/cunning/limits'
import { betaServiceGuard } from '@/lib/beta-services'

// GET /api/cunning/usage — プラン・当月利用時間・ナレッジ数
export async function GET() {
  // 開発中のベータ版のため、許可した人だけが使える（src/lib/beta-services.ts。2026-10-19）
  const betaBlocked = await betaServiceGuard('cunning')
  if (betaBlocked) return betaBlocked
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
