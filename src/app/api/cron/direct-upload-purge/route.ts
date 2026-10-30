import { purgeStaleMultipart, multipartEnabled } from '@/lib/direct-upload/multipart'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// 1日1回：24時間たった未完了の小分け送信を S3 で中止し、ABORTED にする
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!multipartEnabled()) return Response.json({ ok: true, skipped: 'disabled' })
  try {
    const r = await purgeStaleMultipart()
    return Response.json({ ok: r.failed === 0, ...r }, { status: r.failed ? 503 : 200 })
  } catch {
    return Response.json({ error: 'cleanup unavailable' }, { status: 503 })
  }
}
