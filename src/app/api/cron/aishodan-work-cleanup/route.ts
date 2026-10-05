import { cleanupAishodanWorkTasks } from '@/lib/aishodan/cleanup-work-tasks'
import { recoverStaleAishodanSessions } from '@/lib/aishodan/recover-stale-sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const sessions = await recoverStaleAishodanSessions()
    const tasks = await cleanupAishodanWorkTasks()
    return Response.json({ ok: sessions.failed === 0, ...tasks, sessions }, { status: sessions.failed ? 503 : 200 })
  } catch {
    console.error('[aishodan-work-cleanup] metadata cleanup unavailable')
    return Response.json({ error: '商談の処理記録を整理できませんでした。' }, { status: 503 })
  }
}
