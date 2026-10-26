import { NextResponse } from 'next/server'
import { budgetedPaidChecks } from '@/lib/system-watch/paid-run'
import { PAID_ENABLED_KEY } from '@/lib/system-watch/paid-checks'
import { PAID_AGENT_ENABLED_KEY } from '@/lib/system-watch/agent-checks'
import { DAILY_CAP_YEN, readSpend } from '@/lib/system-watch/budget'
import { runWatch } from '@/lib/system-watch/run'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// ドヤAIの常時確認（有料の API を使う分・1日1回）
// ⚠️ 従量課金。グループごとに SystemSetting のスイッチが 'true' のときだけ動く（どちらも既定は止まっている）。
//    watch:v1:paid-enabled       … 3社の安いモデルに短い文を返させる（1日 約0.02円）
//    watch:v1:paid-agent-enabled … エージェントの B1・B2（1日 約4.2円。2026-10-26 ユーザー承認・1日 約10円まで）
// 1日の累計の見込み額が 10円に届いたら、残りは回さない（src/lib/system-watch/budget.ts）。
// 認証: Authorization: Bearer ${CRON_SECRET}。
// ============================================
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { checks, groups, skipped } = await budgetedPaidChecks()
  if (!checks.length) {
    return NextResponse.json({ skipped: true, reason: `${PAID_ENABLED_KEY} と ${PAID_AGENT_ENABLED_KEY} がどちらも true ではないため、有料の確認は動かしていません` })
  }
  // 上限を正しく数えるため、1つずつ回す
  const report = await runWatch('paid', checks, { concurrency: 1 })
  const spend = await readSpend()
  return NextResponse.json({
    ok: report.failed.length === 0,
    checkedAt: report.checkedAt,
    groups,
    spentTodayYen: spend.yen,
    capYen: DAILY_CAP_YEN,
    skippedByCap: skipped,
    failed: report.failed.map(f => ({ id: f.id, label: f.label, status: f.status, error: f.error })),
    sent: report.sent,
  })
}
