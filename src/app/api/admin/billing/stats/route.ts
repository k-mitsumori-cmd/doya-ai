import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import type { AdminBillingPeriod } from '@/lib/admin-billing-period'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { valid } = await verifyAdminSession(cookieStore.get(COOKIE_NAME)?.value || null)
    if (!valid) return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401, headers })
    const params = request.nextUrl.searchParams
    const period = params.get('period') ?? 'month'
    const refresh = params.get('refresh')
    if (params.getAll('period').length > 1 || params.getAll('refresh').length > 1 || !['month', 'quarter', 'year'].includes(period) || (refresh !== null && refresh !== '1' && refresh !== '0')) {
      return NextResponse.json({ error: '集計期間が正しくありません' }, { status: 400, headers })
    }
    const { readAdminBillingData } = await import('@/lib/admin-billing-data')
    return NextResponse.json(await readAdminBillingData(period as AdminBillingPeriod, refresh === '1'), { headers })
  } catch {
    console.error('Admin billing data unavailable')
    return NextResponse.json({ error: '売上・課金データの取得に失敗しました' }, { status: 503, headers })
  }
}
