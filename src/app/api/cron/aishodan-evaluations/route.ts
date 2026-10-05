import { recoverEvaluations } from '@/lib/aishodan/recover-evaluations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // A single session per invocation bounds provider work; remaining tasks stay durable.
    const result = await recoverEvaluations(1)
    if (result.exhausted > 0) console.error('[aishodan-evaluations] automatic evaluation retry exhausted', result.exhausted)
    return Response.json({ ok: result.exhausted === 0, ...result }, { status: result.exhausted > 0 ? 503 : 200 })
  } catch {
    console.error('[aishodan-evaluations] recovery unavailable')
    return Response.json({ error: '商談の評価回収を実行できませんでした。' }, { status: 503 })
  }
}
