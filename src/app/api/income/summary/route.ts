export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { badRequest } from '@/lib/income/access'
import { isMonthKey, todayJst } from '@/lib/income/dates'
import { withIncome } from '@/lib/income/route'
import { buildSummary } from '@/lib/income/summary'

export async function GET(req: NextRequest) {
  return withIncome(req, 'member', async (ctx) => {
    const month = new URL(req.url).searchParams.get('month') || todayJst().slice(0, 7)
    if (!isMonthKey(month)) return badRequest('月の指定が正しくありません')
    return NextResponse.json({ organizationName: ctx.organizationName, role: ctx.role, ...(await buildSummary(ctx, month)) })
  })
}
