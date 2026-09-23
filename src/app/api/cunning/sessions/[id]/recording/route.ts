import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { updateCunningRecording } from '@/lib/cunning/recording-ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId()
    if (!userId) return Response.json({ error: 'ログインが必要です' }, { status: 401, headers })
    let body: unknown
    try { body = await request.json() } catch { return Response.json({ error: '入力が不正です' }, { status: 400, headers }) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: '入力が不正です' }, { status: 400, headers })
    const input = body as Record<string, unknown>
    if (typeof input.action !== 'string' || !['start', 'heartbeat', 'stop'].includes(input.action)) return Response.json({ error: '操作が不正です' }, { status: 400, headers })
    const key = input.action === 'start' ? input.requestKey : input.token
    if (typeof key !== 'string' || !key.trim() || key.length > 128) return Response.json({ error: '録音識別子が不正です' }, { status: 400, headers })
    const { id } = await context.params
    const command = input.action === 'start' ? { action: 'start' as const, requestKey: key }
      : { action: input.action as 'heartbeat' | 'stop', token: key }
    // No client time, duration or quota is forwarded to the ledger.
    const result = await updateCunningRecording(prisma, userId, id, command)
    if (result.state === 'active' || (result.state === 'stopped' && input.action === 'stop')) return Response.json(result, { headers })
    if (result.state === 'missing') return Response.json({ error: 'セッションが見つかりません' }, { status: 404, headers })
    if (result.state === 'limit') return Response.json({ error: '今月の利用時間の上限に達しました。', code: 'LIMIT', upgradeUrl: '/cunning/pricing' }, { status: 403, headers })
    const error = result.state === 'legacy' ? 'このセッションは旧方式です。新しいセッションを開始してください。'
      : result.state === 'conflict' ? '別の録音が開始されているか、録音識別子が無効です。'
      : '録音の有効期限が切れています。新しいセッションを開始してください。'
    return Response.json({ error, code: result.state === 'legacy' ? 'RECORDING_VERSION' : 'RECORDING_ENDED' }, { status: 409, headers })
  } catch {
    return Response.json({ error: '録音の利用状況を確認できません。しばらくしてから再試行してください。' }, { status: 503, headers })
  }
}
