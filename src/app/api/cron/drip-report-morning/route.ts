import { NextResponse } from 'next/server'
import { sendDripReport, sendErrorNotification } from '@/lib/notifications'
import { withRetry } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// ドリップ（Resend）配信レポート・朝（JST 8:00 = 23:00 UTC）
// ※ Vercel Cron はパスにクエリ文字列(?slot=)を付けると定時発火しないため、
//   slotごとに独立したプレーンパスのルートを用意している。
// ============================================

export async function GET(request: Request) {
  // Vercel Cron からの呼び出しを認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await withRetry(() => sendDripReport('morning'))
    return NextResponse.json({ success: true, slot: 'morning' })
  } catch (error: any) {
    console.error('[Cron] drip-report-morning error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send drip report (morning)',
      errorStack: error?.stack,
      pathname: '/api/cron/drip-report-morning',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send drip report (morning)', stack: error?.stack },
      { status: 500 },
    )
  }
}
