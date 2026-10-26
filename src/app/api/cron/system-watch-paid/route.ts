import { NextResponse } from 'next/server'
import { paidChecks, paidChecksEnabled, PAID_ENABLED_KEY } from '@/lib/system-watch/paid-checks'
import { runWatch } from '@/lib/system-watch/run'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ============================================
// ドヤAIの常時確認（有料の API を使う分・1日1回）
// ⚠️ 従量課金。SystemSetting の watch:v1:paid-enabled が 'true' のときだけ動く。
//    有効にするのはユーザーの承認の後（見込み額は src/lib/system-watch/paid-checks.ts の先頭）。
// 認証: Authorization: Bearer ${CRON_SECRET}。
// ============================================
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!(await paidChecksEnabled())) {
    return NextResponse.json({ skipped: true, reason: `${PAID_ENABLED_KEY} が true ではないため、有料の確認は動かしていません` })
  }
  const report = await runWatch('paid', paidChecks())
  return NextResponse.json({
    ok: report.failed.length === 0,
    checkedAt: report.checkedAt,
    failed: report.failed.map(f => ({ id: f.id, label: f.label, status: f.status, error: f.error })),
    sent: report.sent,
  })
}
