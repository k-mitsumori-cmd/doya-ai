import { prisma } from '@/lib/prisma'
import { purgeQueuedSeoImages } from '@/lib/seo-image-purge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await purgeQueuedSeoImages(prisma)
    return Response.json({ ok: result.failed === 0, ...result }, { status: result.failed ? 503 : 200 })
  } catch {
    return Response.json({ error: 'SEO image cleanup unavailable' }, { status: 503 })
  }
}
