import { NextResponse } from 'next/server'
import { sendGCPUsageReport, sendErrorNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Vercel Cron からの呼び出しを認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await sendGCPUsageReport()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Cron] gcp-usage error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send GCP usage report',
      errorStack: error?.stack,
      pathname: '/api/cron/gcp-usage',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send GCP usage report', stack: error?.stack },
      { status: 500 },
    )
  }
}
