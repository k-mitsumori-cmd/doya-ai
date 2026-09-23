import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { reserveCunningAudioWindow, finalizeCunningAudioWindows } from '@/lib/cunning/audio-windows'

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
    const { action, recordingToken, speaker, requestKey } = body as Record<string, unknown>
    if ((action !== 'reserve' && action !== 'finalize') || typeof recordingToken !== 'string' || !recordingToken || recordingToken.length > 128) {
      return Response.json({ error: '録音識別子または操作が不正です' }, { status: 400, headers })
    }
    const { id: sessionId } = await context.params
    const owner = { userId, sessionId, recordingToken }
    if (action === 'finalize') {
      const result = await finalizeCunningAudioWindows(prisma, owner)
      if (result.state === 'complete') return Response.json(result, { headers })
      return Response.json({ error: '録音の停止または音声の保存が完了していません。', code: result.state, ...('pending' in result ? { pending: result.pending } : {}) }, { status: result.state === 'missing' ? 404 : 409, headers })
    }
    if ((speaker !== 'remote' && speaker !== 'self') || typeof requestKey !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(requestKey)) {
      return Response.json({ error: '音声の識別情報が不正です' }, { status: 400, headers })
    }
    const result = await reserveCunningAudioWindow(prisma, { ...owner, speaker, requestKey })
    if (result.state === 'reserved') return Response.json({ state: result.state, windowId: result.window.id, sequence: result.window.sequence, speaker: result.window.speaker }, { headers })
    return Response.json({ error: '音声の受付枠を確保できませんでした。録音状態を確認してください。', code: result.state }, { status: result.state === 'missing' ? 404 : 409, headers })
  } catch {
    return Response.json({ error: '音声の受付状態を確認できません。再試行してください。' }, { status: 503, headers })
  }
}
