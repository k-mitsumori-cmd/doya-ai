import { prisma } from '@/lib/prisma'
import { purgeQueuedSeoImages, reconcilePendingSeoImages } from '@/lib/seo-image-purge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const deleted = await purgeQueuedSeoImages(prisma)
    const pending = await reconcilePendingSeoImages(prisma)
    const failed = deleted.failed + pending.failed
    return Response.json({ ok: failed === 0, deleted, pending }, { status: failed ? 503 : 200 })
  } catch {
    return Response.json({ error: 'SEO image cleanup unavailable' }, { status: 503 })
  }
}
