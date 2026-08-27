import { NextResponse } from 'next/server'
import { sendSpendReport } from '@/lib/spend-report'
import { sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  // ⚠️ CRON_SECRET が未設定だとテンプレートが "Bearer undefined" になり、
  //    その文字列を送れば通ってしまう。未設定なら動かさないこと。
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await sendSpendReport()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Cron] spend-report error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send spend report',
      errorStack: error?.stack,
      pathname: '/api/cron/spend-report',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json({ error: error?.message || 'Failed to send spend report' }, { status: 500 })
  }
}
