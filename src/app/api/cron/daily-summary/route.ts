import { NextResponse } from 'next/server'
import { sendDailySummary } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Vercel Cron からの呼び出しを認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await sendDailySummary()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Cron] daily-summary error:', error)
    return NextResponse.json({ error: 'Failed to send daily summary' }, { status: 500 })
  }
}
