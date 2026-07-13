import { NextResponse } from 'next/server'
import { sendNoroiEngagementReport } from '@/lib/noroi-engagement-report'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// 呪い日記 エンゲージメント日次レポート・毎朝（JST 10:10 = 01:10 UTC）
// 自前Supabaseから DAU/新規/投稿/ガチャ/課金/継続率を集計して Slack 通知
// 接続: NOROI_SUPABASE_URL / NOROI_SUPABASE_SERVICE_ROLE_KEY
// 通知先: SLACK_APPSTORE_MARKETING_WEBHOOK_URL（未設定は SLACK_APPSTORE_WEBHOOK_URL）
// ============================================

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendNoroiEngagementReport()
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Cron] noroi-engagement-report error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send noroi engagement report',
      errorStack: error?.stack,
      pathname: '/api/cron/noroi-engagement-report',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send noroi engagement report' },
      { status: 500 },
    )
  }
}
