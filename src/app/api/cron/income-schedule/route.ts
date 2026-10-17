export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncContractSchedule } from '@/lib/income/contracts'

/**
 * ドヤ収入管理: 売上予定の補完（毎朝 JST 6:00）
 * 期間の定めがない契約・自動更新の契約は、12 か月先までしか予定を持たないため、毎日 1 か月ずつ先へ延ばす。
 * 請求漏れ・入金遅延はダッシュボードが読むときに計算するので、ここでは状態を書き換えない（設計書 §4.2-3）。
 * 認証: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const contracts = await prisma.incomeContract.findMany({ where: { status: 'active' }, select: { id: true, organizationId: true }, take: 5000 })
  let ok = 0
  const failed: string[] = []
  for (const c of contracts) {
    try {
      await prisma.$transaction((tx) => syncContractSchedule(tx, c.id, c.organizationId), { timeout: 30000 })
      ok++
    } catch (e) {
      console.error('[cron/income-schedule] failed', { contractId: c.id, code: (e as { code?: string })?.code })
      failed.push(c.id)
    }
  }
  return NextResponse.json({ contracts: contracts.length, ok, failed: failed.length })
}
