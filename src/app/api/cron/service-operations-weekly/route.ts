import { GET as runServiceOperations } from '../service-operations/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// 運用通知（mode=weekly）の定時実行
// ※ Vercel Cron はパスにクエリ文字列(?mode=)を付けると定時発火しないため、
//   mode ごとに独立したプレーンパスのルートを用意している。
//   認証・mode の検証・重複実行の抑止は /api/cron/service-operations 側で行う。
//   汎用の /api/cron/service-operations?mode= は手動実行用に残置。
// ============================================

export async function GET(request: Request) {
  const url = new URL(request.url)
  url.pathname = '/api/cron/service-operations'
  url.searchParams.set('mode', 'weekly')
  return runServiceOperations(new Request(url, { method: 'GET', headers: request.headers }))
}
