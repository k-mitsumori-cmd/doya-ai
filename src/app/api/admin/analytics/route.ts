import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyAdminSession } from '@/lib/admin-auth'
import { privateApiJson } from '@/lib/private-api-response'
import { parseAdminAnalyticsPeriod } from '@/lib/admin-analytics-period'
import { readAdminAnalyticsPeriod } from '@/lib/admin-analytics-period-reader'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value
    if (!(await verifyAdminSession(token || null)).valid) {
      return privateApiJson({ error: '管理者認証が必要です' }, { status: 401 })
    }
    const params = new URL(request.url).searchParams
    let period
    try {
      if (params.getAll('period').length > 1) throw new Error('Duplicate period')
      period = parseAdminAnalyticsPeriod(params.get('period'))
    } catch {
      return privateApiJson({ error: '表示期間を選び直してください' }, { status: 400 })
    }
    return privateApiJson(await readAdminAnalyticsPeriod(period))
  } catch {
    return privateApiJson({ error: '期間内の利用統計を取得できませんでした' }, { status: 503 })
  }
}
