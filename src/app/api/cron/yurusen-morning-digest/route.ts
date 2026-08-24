import { NextResponse } from 'next/server'
import { sendYurusenMorningDigest } from '@/lib/yurusen-morning-digest'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// ゆるせん「朝刊」・毎朝（JST 10:25 = 01:25 UTC）
// 売上/DL・流入経路・国別・ストア/順位・SNS を1通にまとめて Slack 通知。
// 旧 yurusen-appstore-report（DL/売上のみ）を置き換え、呪い日記と同じ粒度に揃えたもの。
// アプリ内の動き（DAU等）は接続情報が未設定のため現在は省略（朝刊に注記が出る）。
// 通知先: SLACK_YURUSEN_APPSTORE_WEBHOOK_URL（未設定は SLACK_APPSTORE_WEBHOOK_URL）
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
    // ?dry=1 で Slack に送らず本文だけ返す（手動確認用）
    const dry = new URL(request.url).searchParams.get('dry') === '1'
    const result = await sendYurusenMorningDigest({ deliver: !dry })
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Cron] yurusen-morning-digest error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send Yurusen morning digest',
      errorStack: error?.stack,
      pathname: '/api/cron/yurusen-morning-digest',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send Yurusen morning digest' },
      { status: 500 },
    )
  }
}
