import { NextResponse } from 'next/server'
import { sendNoroiSummaryReport } from '@/lib/noroi-summary-report'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// 呪い日記 週次まとめレポート・毎週月曜（JST 10:20 = 01:20 UTC / 月曜）
// 先週(月〜日)の売上＋ユーザー実績＋評価を Slack 通知
// ============================================

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await sendNoroiSummaryReport('weekly')
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Cron] noroi-weekly-summary error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send noroi weekly summary',
      errorStack: error?.stack,
      pathname: '/api/cron/noroi-weekly-summary',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send noroi weekly summary' },
      { status: 500 },
    )
  }
}
