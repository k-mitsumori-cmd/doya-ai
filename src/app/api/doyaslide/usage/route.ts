export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/doyaslide/access'
import {
  getUserDoyaSlideLimits,
  getUserTier,
  countProjects,
  getMonthlyUsage,
} from '@/lib/doyaslide/limits'

// GET /api/doyaslide/usage — プラン・利用状況
export async function GET() {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ plan: 'GUEST', tier: 'GUEST' })

    const [tier, limits, projects, slidesThisMonth] = await Promise.all([
      getUserTier(userId),
      getUserDoyaSlideLimits(userId),
      countProjects(userId),
      getMonthlyUsage(userId),
    ])

    return NextResponse.json({
      plan: tier,
      tier,
      limits,
      usage: { projects, slidesThisMonth },
    })
  } catch (e) {
    console.error('[doyaslide/usage]', e)
    return NextResponse.json({ plan: 'FREE', tier: 'FREE' })
  }
}
