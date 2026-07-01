import { NextResponse } from 'next/server'
import { sendDripReport } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Vercel Cron認証（任意）
const CRON_SECRET = process.env.CRON_SECRET

// ============================================
// ドリップ（Resend）配信レポート
// 朝(JST 8:00)・夜(JST 20:00)の1日2回、配信状況をSlackに通知する
//   - vercel.json: /api/cron/drip-report?slot=morning (0 23 * * * UTC)
//                  /api/cron/drip-report?slot=evening (0 11 * * * UTC)
// ============================================

export async function GET(request: Request) {
  // Cron認証（CRON_SECRET が設定されている場合のみ）
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const { searchParams } = new URL(request.url)
  const slotParam = searchParams.get('slot')

  // slot未指定時はJST時刻から自動判定（12時前=朝 / それ以降=夜）
  let slot: 'morning' | 'evening'
  if (slotParam === 'morning' || slotParam === 'evening') {
    slot = slotParam
  } else {
    const jstHour = (new Date().getUTCHours() + 9) % 24
    slot = jstHour < 12 ? 'morning' : 'evening'
  }

  try {
    await sendDripReport(slot)
    return NextResponse.json({ success: true, slot, timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('[DripReport] Cron error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
