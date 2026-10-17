// GET /api/shanai/usage — 記事生成・文字起こしの利用状況
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getShanaiUserId, json, readShanaiUsage, unauthorized } from '@/lib/shanai/access'

export async function GET() {
  try {
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    const usage = await readShanaiUsage(userId)
    return json({ success: true, ...usage })
  } catch {
    console.error('[shanai/usage][GET] failed')
    return json({ error: '利用状況の取得に失敗しました。' }, 500)
  }
}
