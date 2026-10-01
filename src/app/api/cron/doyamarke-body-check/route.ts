import { NextResponse } from 'next/server'
import { runDoyamarkeBodyCheck } from '@/lib/doyamarke-body-check'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// ドヤマーケ記事の本文消失チェック（毎日）
// 公開中の全記事の本文字数・見出し数を確認し、異常がある記事だけを通知する。
// 通知先: SLACK_ANALYTICS_WEBHOOK_URL
// スケジュール: 毎日 JST 7:30（= 22:30 UTC。vercel.json 参照）
// ============================================

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ?dry=1 で Slack 送信せず結果だけ返す（手動テスト用）
    const dryRun = new URL(request.url).searchParams.get('dry') === '1'
    const result = await runDoyamarkeBodyCheck({ dryRun })
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Cron] doyamarke-body-check error:')
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to run doyamarke body check',
      errorStack: error?.stack,
      pathname: '/api/cron/doyamarke-body-check',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: '定期処理を完了できませんでした' },
      { status: 500 },
    )
  }
}
