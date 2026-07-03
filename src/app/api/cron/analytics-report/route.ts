import { NextResponse } from 'next/server'
import { sendAnalyticsReport } from '@/lib/analytics-report'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// GA4 + Search Console アクセスレポート・毎朝（JST 7:00 = 22:00 UTC）
// 対象サイト: 環境変数 ANALYTICS_REPORT_TARGETS
// 通知先: SLACK_ANALYTICS_WEBHOOK_URL
// ============================================

export async function GET(request: Request) {
  // Vercel Cron からの呼び出しを認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendAnalyticsReport()
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Cron] analytics-report error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send analytics report',
      errorStack: error?.stack,
      pathname: '/api/cron/analytics-report',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send analytics report' },
      { status: 500 },
    )
  }
}
