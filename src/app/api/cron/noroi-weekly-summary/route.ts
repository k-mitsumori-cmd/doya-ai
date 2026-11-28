import { NextResponse } from 'next/server'
import { sendNoroiSummaryReport } from '@/lib/noroi-summary-report'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// 呪い日記 週次まとめレポート・毎週火曜（JST 03:20 = 18:20 UTC / 月曜）
// Apple週次Sales Reportsの公開予定（米国太平洋時間の月曜08:00頃）以降に取得する
// 先週(月〜日)の売上＋ユーザー実績＋評価を Slack 通知
// ============================================

export async function GET(request: Request) {
  // ⚠️ CRON_SECRET が未設定だとテンプレートが "Bearer undefined" になり、
    //    その文字列を送れば通ってしまう。未設定なら動かさないこと。
    const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await sendNoroiSummaryReport('weekly')
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Cron] noroi-weekly-summary error:')
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send noroi weekly summary',
      errorStack: error?.stack,
      pathname: '/api/cron/noroi-weekly-summary',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: '定期処理を完了できませんでした' },
      { status: 500 },
    )
  }
}
