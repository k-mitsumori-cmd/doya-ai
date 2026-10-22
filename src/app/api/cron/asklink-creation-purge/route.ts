import { collectAskLinkCreationReceipts } from '@/lib/asklink/creation-operation'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await collectAskLinkCreationReceipts()
    return Response.json({ ok: result.failed === 0, ...result }, { status: result.failed ? 503 : 200 })
  } catch {
    console.error('[asklink-creation-purge] metadata cleanup unavailable')
    return Response.json({ error: '作成記録を整理できませんでした。' }, { status: 503 })
  }
}
