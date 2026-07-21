import { NextResponse } from 'next/server'
import { sendAppStoreSourceReport } from '@/lib/appstore-source-report'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// 呪い日記 App Store 流入経路（Source Type）日次レポート・毎朝（JST 10:35 = 01:35 UTC）
// Analytics Reports API（Discovery and Engagement）から流入経路別に集計し Slack 通知。
// 認証情報: APPSTORE_KEY_ID / APPSTORE_ISSUER_ID / APPSTORE_PRIVATE_KEY / APPSTORE_APP_ID
// 通知先: SLACK_APPSTORE_SOURCE_WEBHOOK_URL（未設定なら SLACK_APPSTORE_WEBHOOK_URL）
// ============================================

export async function GET(request: Request) {
  // Vercel Cron からの呼び出しを認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendAppStoreSourceReport()
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Cron] appstore-source-report error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send App Store source report',
      errorStack: error?.stack,
      pathname: '/api/cron/appstore-source-report',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send App Store source report' },
      { status: 500 },
    )
  }
}
