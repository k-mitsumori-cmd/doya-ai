export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { hasMinRole, withExpense } from '@/lib/expense/access'
import { listUpcomingPayments } from '@/lib/expense/expense-read'

// GET /api/expense/upcoming?org=&days=30 — 未払いの支払（支払日超過を含む）。振込先は manager 以上にだけ含める
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => {
    const days = Number(req.nextUrl.searchParams.get('days') ?? 30)
    const payments = await listUpcomingPayments(ctx.organizationId, {
      days: Number.isFinite(days) ? days : 30,
      includeBank: hasMinRole(ctx.role, 'manager') && req.nextUrl.searchParams.get('bank') === '1',
    })
    return NextResponse.json({ payments })
  })
}
