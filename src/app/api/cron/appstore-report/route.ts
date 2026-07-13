import { NextResponse } from 'next/server'
import { sendAppStoreReport } from '@/lib/appstore-report'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// 呪い日記 App Store 日次レポート・毎朝（JST 10:00 = 01:00 UTC）
// DL数・売上（税込/手取り、円換算）を Slack 通知
// 認証情報: APPSTORE_KEY_ID / APPSTORE_ISSUER_ID / APPSTORE_PRIVATE_KEY / APPSTORE_VENDOR_NUMBER
// 通知先: SLACK_APPSTORE_WEBHOOK_URL
// ============================================

export async function GET(request: Request) {
  // Vercel Cron からの呼び出しを認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ?date=YYYY-MM-DD で特定日を強制取得（手動テスト用。定時cronはプレーンパスで最新日を自動選択）
    const date = new URL(request.url).searchParams.get('date') || undefined
    const result = await sendAppStoreReport({ date })
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Cron] appstore-report error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send App Store report',
      errorStack: error?.stack,
      pathname: '/api/cron/appstore-report',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send App Store report' },
      { status: 500 },
    )
  }
}
