import { NextResponse } from 'next/server'
import { sendYurusenAppStoreReport } from '@/lib/yurusen-appstore-report'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// ゆるせん App Store 日次レポート・毎朝（JST 10:25 = 01:25 UTC）
// DL数・売上（税込/手取り、円換算）を Slack 通知
// 認証情報: APPSTORE_KEY_ID / APPSTORE_ISSUER_ID / APPSTORE_PRIVATE_KEY / APPSTORE_VENDOR_NUMBER（アカウント共通）
// 通知先: SLACK_YURUSEN_APPSTORE_WEBHOOK_URL
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
    const result = await sendYurusenAppStoreReport({ date })
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Cron] yurusen-appstore-report error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send yurusen App Store report',
      errorStack: error?.stack,
      pathname: '/api/cron/yurusen-appstore-report',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send yurusen App Store report' },
      { status: 500 },
    )
  }
}
