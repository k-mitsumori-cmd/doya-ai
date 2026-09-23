export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/cunning/access'
import { getCunningUsage } from '@/lib/cunning/limits'

// GET /api/cunning/usage — プラン・当月利用時間・ナレッジ数
export async function GET() {
  try {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ plan: 'GUEST' }, { headers: { 'Cache-Control': 'no-store' } })
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
