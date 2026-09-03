import { NextResponse } from 'next/server'
import { sendNoroiMorningDigest } from '@/lib/noroi-morning-digest'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// 呪い日記「朝刊」・毎朝（JST 9:00 = 00:00 UTC）
// 売上/DL・アプリ内の動き・流入経路・国別・ストア/順位・SNS を1通にまとめて Slack 通知。
// 旧: appstore-report / appstore-marketing-report / noroi-engagement-report /
//     appstore-country-report / appstore-source-report の5通を統合したもの。
// 通知先: SLACK_APPSTORE_WEBHOOK_URL
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
    const result = await sendNoroiMorningDigest({ deliver: !dry })
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Cron] noroi-morning-digest error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send Noroi morning digest',
      errorStack: error?.stack,
      pathname: '/api/cron/noroi-morning-digest',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send Noroi morning digest' },
      { status: 500 },
    )
  }
}
