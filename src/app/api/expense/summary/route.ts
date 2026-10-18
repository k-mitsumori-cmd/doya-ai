export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { withExpense } from '@/lib/expense/access'
import { getExpenseSummary } from '@/lib/expense/expense-read'

// GET /api/expense/summary?org= — ダッシュボード: 今月の出金・支払済・固定費（月額）・SaaS 合計・要対応・12 か月の出金
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => NextResponse.json(await getExpenseSummary(ctx.organizationId)))
}
