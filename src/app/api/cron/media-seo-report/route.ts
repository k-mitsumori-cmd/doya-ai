import { NextResponse } from 'next/server'
import { sendMediaSeoReport } from '@/lib/media-seo-report'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// 週次メディアSEOレポート（呪い日記 / ゆるせん オウンドメディア）
// GSC sc-domain:surisuta.jp を game.surisuta.jp/{noroi,yurusen} で絞り込み集計
// 通知先: SLACK_ANALYTICS_WEBHOOK_URL（アクセスレポートと同一チャンネル）
// スケジュール: 毎週月曜 JST 7:00（= 日曜 22:00 UTC。vercel.json 参照）
// ============================================

export async function GET(request: Request) {
  // Vercel Cron からの呼び出しを認証
  // ⚠️ CRON_SECRET が未設定だとテンプレートが "Bearer undefined" になり、
    //    その文字列を送れば通ってしまう。未設定なら動かさないこと。
    const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ?dry=1 で Slack 送信せず本文だけ返す（手動テスト用）
    const dryRun = new URL(request.url).searchParams.get('dry') === '1'
    const result = await sendMediaSeoReport({ dryRun })
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Cron] media-seo-report error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send media SEO report',
      errorStack: error?.stack,
      pathname: '/api/cron/media-seo-report',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send media SEO report' },
      { status: 500 },
    )
  }
}
