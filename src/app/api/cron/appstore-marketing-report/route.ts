import { NextResponse } from 'next/server'
import { sendAppStoreMarketingReport } from '@/lib/appstore-marketing-report'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// 呪い日記 アプリマーケ日次レポート・毎朝（JST 10:05 = 01:05 UTC）
// ストア評価・チャート順位・キーワード検索順位を Slack 通知（前日比つき）
// 対象/キーワード: APPSTORE_APP_ID / APPSTORE_MARKETING_KEYWORDS
// 通知先: SLACK_APPSTORE_MARKETING_WEBHOOK_URL（未設定は SLACK_APPSTORE_WEBHOOK_URL）
// ============================================

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendAppStoreMarketingReport()
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Cron] appstore-marketing-report error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send App Store marketing report',
      errorStack: error?.stack,
      pathname: '/api/cron/appstore-marketing-report',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send App Store marketing report' },
      { status: 500 },
    )
  }
}
