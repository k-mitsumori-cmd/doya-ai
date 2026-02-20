import { NextResponse } from 'next/server'
import { sendWeeklySummary } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await sendWeeklySummary()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Cron] weekly-summary error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to send weekly summary', stack: error?.stack },
      { status: 500 }
    )
  }
}
