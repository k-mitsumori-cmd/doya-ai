import { AIO_FREE_SCANS_PER_WEEK, AIO_SCANS_PER_MONTH } from './types'
import { isPaidPlan } from '@/lib/unified-plan'

/** Free: rolling seven days. Paid: calendar month in JST. */
export function scanQuota(plan: string | null | undefined, now = new Date()) {
  const paid = isPaidPlan(plan)
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const since = paid
    ? new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000)
    : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const limit = !paid ? AIO_FREE_SCANS_PER_WEEK
    : String(plan).toUpperCase() === 'ENTERPRISE' ? AIO_SCANS_PER_MONTH.ENTERPRISE : AIO_SCANS_PER_MONTH.PRO
  const error = paid
    ? `今月のスキャン上限（${limit}回）に達しました。来月1日に枠が戻ります。追加をご希望の場合はお問い合わせよりご相談ください。`
    : '無料プランは直近7日間で1回までスキャンできます。組織オーナーのプランをアップグレードすると上限が広がります。'
  return { paid, since, limit, error }
}
