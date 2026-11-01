import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resyncOrganization } from '@/lib/expense/sync'
import { collectAndNotify } from '@/lib/expense/notify'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// 毎朝: 支払予定を 12 か月先まで補完 → 源泉税の集計 → 要対応を通知（ドヤ支出管理 設計書 §10.2-9）
export async function GET(request: Request) {
  // ⚠️ CRON_SECRET が未設定なら動かさない（"Bearer undefined" で通ってしまうため）
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const orgs = await prisma.expenseOrganization.findMany({ select: { id: true } })
  let failedOrgs = 0
  let failedContracts = 0
  let reminders = 0
  for (const o of orgs) {
    try {
      const r = await resyncOrganization(o.id)
      failedContracts += r.failed
      reminders += (await collectAndNotify(o.id)).created
    } catch {
      failedOrgs++
    }
  }
  if (failedOrgs > 0) {
    await sendErrorNotification({
      errorMessage: `expense-schedule: ${failedOrgs} 組織で失敗しました`,
      pathname: '/api/cron/expense-schedule',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
  }
  // 為替レート未設定などで飛ばした契約は件数だけ返す（画面側で契約ごとに理由を出す）
  return NextResponse.json({ organizations: orgs.length, failedOrgs, failedContracts, reminders })
}
