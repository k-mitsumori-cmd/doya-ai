import { purgeStaleMultipart, multipartEnabled } from '@/lib/direct-upload/multipart'
import { purgeStaleStaged } from '@/lib/direct-upload/stage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// 1日1回：(1) 画像の一時置き場の古いファイルを消す (2) 24時間たった未完了の小分け送信を S3 で中止し、ABORTED にする
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let staged: { removed: number } | null = null
  try {
    staged = await purgeStaleStaged()
  } catch {
    /* 一時置き場の掃除に失敗しても、小分け送信の片づけは続ける */
  }
  if (!multipartEnabled()) return Response.json({ ok: true, staged, multipart: 'disabled' })
  try {
    const r = await purgeStaleMultipart()
    return Response.json({ ok: r.failed === 0, staged, ...r }, { status: r.failed ? 503 : 200 })
  } catch {
    return Response.json({ error: 'cleanup unavailable' }, { status: 503 })
  }
}
