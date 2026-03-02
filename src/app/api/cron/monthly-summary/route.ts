import { NextResponse } from 'next/server'
import { sendMonthlySummary, sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await sendMonthlySummary()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Cron] monthly-summary error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send monthly summary',
      errorStack: error?.stack,
      pathname: '/api/cron/monthly-summary',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send monthly summary', stack: error?.stack },
      { status: 500 }
    )
  }
}
