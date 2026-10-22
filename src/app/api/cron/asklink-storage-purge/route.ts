import { collectAskLinkAccountStorage } from '@/lib/asklink/storage-purge'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await collectAskLinkAccountStorage()
    return Response.json({ ok: result.failed === 0 && result.needsReview === 0, ...result }, { status: result.failed || result.needsReview ? 503 : 200 })
  } catch {
    console.error('[asklink-storage-purge] cleanup unconfirmed')
    return Response.json({ error: '画像の削除を確認できませんでした。' }, { status: 503 })
  }
}
