import { purgeExpiredAishodanRecords } from '@/lib/aishodan/purge-expired-records'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return Response.json({ ok: true, ...await purgeExpiredAishodanRecords() })
  } catch {
    console.error('[aishodan-retention] record cleanup unavailable')
    return Response.json({ error: '商談の保存期限の処理を実行できませんでした。' }, { status: 503 })
  }
}
