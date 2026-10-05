import { deliverPendingCompletionNotifications, deliverPendingFailureNotifications } from '@/lib/aishodan/deliver-completion-notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const notifications = await deliverPendingCompletionNotifications(1)
    const failures = await deliverPendingFailureNotifications(1)
    const exhausted = notifications.exhausted + failures.exhausted
    if (exhausted > 0) console.error('[aishodan-notifications] delivery retry exhausted', exhausted)
    return Response.json({ ok: exhausted === 0, ...notifications, exhausted, failures }, { status: exhausted > 0 ? 503 : 200 })
  } catch {
    console.error('[aishodan-notifications] delivery unavailable')
    return Response.json({ error: '商談の通知回収を実行できませんでした。' }, { status: 503 })
  }
}
