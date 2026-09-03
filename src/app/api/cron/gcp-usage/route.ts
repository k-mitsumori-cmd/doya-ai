/**
 * GCP 利用量の Slack 通知。
 *
 * ⚠ **2026-09-03 に cron から外した。** 「あまり機能していない」との判断で、
 *   毎朝の自動送信を止めた（`vercel.json` から該当エントリを削除）。
 *   ルートは残してあるので、必要になったら vercel.json へ戻すだけで復活する。
 *
 * ⚠ **GCP の数字自体は失われていない。** 朝7時の支出レポート
 *   （`/api/cron/spend-report` → `src/lib/spend-report.ts`）が
 *   同じ `fetchGCPUsageReport()` を呼んでおり、そちらには載り続ける。
 *   このファイルを消すと支出レポートが壊れるわけではないが、
 *   単独で見たいときの手掛かりが無くなるので残す。
 */
import { NextResponse } from 'next/server'
import { sendGCPUsageReport, sendErrorNotification } from '@/lib/notifications'
import { withRetry } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Vercel Cron からの呼び出しを認証
  // ⚠️ CRON_SECRET が未設定だとテンプレートが "Bearer undefined" になり、
    //    その文字列を送れば通ってしまう。未設定なら動かさないこと。
    const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await withRetry(() => sendGCPUsageReport())
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
