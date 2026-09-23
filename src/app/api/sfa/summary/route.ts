import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
    const cutoff = new Date(Date.now() - 14 * 86400000)
    // One snapshot, no list limit. Numeric arithmetic avoids BigInt multiplication overflow;
    // strings preserve yen totals beyond JavaScript's safe integer range.
    const [summary] = await prisma.$queryRaw<Array<{
      totalCount: number; openCount: number; staleCount: number; openTaskCount: number;
      openTotal: string; weighted: string; wonTotal: string;
    }>>`
      SELECT COUNT(*)::int AS "totalCount",
        COUNT(*) FILTER (WHERE status = 'open')::int AS "openCount",
        COUNT(*) FILTER (WHERE status = 'open' AND "lastActivityAt" < (${cutoff}::timestamptz AT TIME ZONE 'UTC'))::int AS "staleCount",
        COALESCE(SUM(amount::numeric) FILTER (WHERE status = 'open'), 0)::text AS "openTotal",
        ROUND(COALESCE(SUM(amount::numeric * probability::numeric / 100) FILTER (WHERE status = 'open'), 0))::text AS weighted,
        COALESCE(SUM(amount::numeric) FILTER (WHERE status = 'won'), 0)::text AS "wonTotal",
        (SELECT COUNT(*)::int FROM sfa_tasks WHERE "organizationId" = ${ctx.organizationId} AND status <> 'done') AS "openTaskCount"
      FROM sfa_deals WHERE "organizationId" = ${ctx.organizationId} AND "isActive" = true
    `
    return NextResponse.json({ summary }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '営業状況を取得できませんでした。再試行してください。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
