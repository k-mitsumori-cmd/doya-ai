import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/doyaslide/access'
import { DoyaSlideOperationError, recoverDoyaSlideOperation, type DoyaSlideOperationInput } from '@/lib/doyaslide/generation-operation'
import { runDoyaSlideOperation } from '@/lib/doyaslide/generation-worker'
import { quotaExceededPayload } from '@/lib/doyaslide/limits'
import { prisma } from '@/lib/prisma'

type Binding = { kind: DoyaSlideOperationInput['kind']; slideId?: string }
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' },
  })
}

function operationReply(input: DoyaSlideOperationInput, result: Awaited<ReturnType<typeof runDoyaSlideOperation>>) {
  if (result.state === 'limit') return reply(quotaExceededPayload(result.limit), 403)
  if (result.state === 'unavailable') return reply({ operationId: input.operationId.toLowerCase(), projectId: input.projectId, kind: input.kind, state: 'unavailable', error: '保存結果を確認できません。' }, 404)
  const receipt = 'receipt' in result ? result.receipt : undefined
  return reply({
    operationId: input.operationId.toLowerCase(), projectId: input.projectId, kind: input.kind, state: result.state,
    ...(receipt ? {
      skipped: receipt.skipped, deferred: receipt.deferred, limit: receipt.limit,
      ...(receipt.skipped > 0 ? { quota: quotaExceededPayload(receipt.limit) } : {}),
      errorCount: receipt.slots.filter(slot => slot.phase === 'failed').length,
      results: receipt.slots.flatMap(slot => slot.phase === 'done' && slot.output ? [{
        slideId: slot.id, imageUrl: slot.output.imageUrl, rawImageUrl: slot.output.rawImageUrl,
        version: slot.output.version, model: slot.output.model,
      }] : []),
    } : {}),
  }, result.state === 'pending' || result.state === 'busy' ? 202 : 200)
}

async function readBody(req: NextRequest) {
  const maximum = 16384
  if (Number(req.headers.get('content-length')) > maximum) throw new DoyaSlideOperationError(413, 'INPUT_TOO_LARGE', '入力が長すぎます。')
  if (!req.body) throw new DoyaSlideOperationError(400, 'INVALID_OPERATION', '入力内容を確認してください。')
  const reader = req.body.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined
  let stop: (() => void) | undefined
  try {
    const stopped = new Promise<never>((_, reject) => {
      stop = () => reject(new DoyaSlideOperationError(408, 'INPUT_TIMEOUT', '入力を受け取れませんでした。通信状態をご確認ください。'))
      timer = setTimeout(stop, 15000)
      req.signal.addEventListener('abort', stop, { once: true })
      if (req.signal.aborted) stop()
    })
    const reading = (async () => {
      const chunks: Uint8Array[] = []
      let length = 0
      while (true) {
        const next = await reader.read()
        if (next.done) break
        length += next.value.byteLength
        if (length > maximum) throw new DoyaSlideOperationError(413, 'INPUT_TOO_LARGE', '入力が長すぎます。')
        chunks.push(next.value)
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown }
      catch { throw new DoyaSlideOperationError(400, 'INVALID_OPERATION', '入力形式が正しくありません。') }
    })()
    return await Promise.race([reading, stopped])
  } finally {
    if (timer) clearTimeout(timer)
    if (stop) req.signal.removeEventListener('abort', stop)
    void reader.cancel().catch(() => {})
  }
}

export async function postDoyaSlideOperation(req: NextRequest, binding?: Binding) {
  let operationId: string | undefined
  try {
    const actor = await getUserId()
    if (!actor) return reply({ error: 'ログインが必要です。' }, 401)
    if (binding && !req.body) return reply({ error: '画面を再読み込みしてから生成してください。', code: 'OPERATION_REQUIRED' }, 409)
    const body = await readBody(req)
    const allowed = new Set(binding ? binding.kind === 'batch' ? ['operationId', 'projectId', 'onlyPending'] : binding.kind === 'chat' ? ['operationId', 'message'] : ['operationId'] : ['operationId', 'projectId', 'kind', 'slideId', 'message', 'onlyPending'])
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.has(key))) {
      throw new DoyaSlideOperationError(400, 'INVALID_OPERATION', '操作内容を確認してください。')
    }
    const supplied = body as Record<string, unknown>
    if (binding && supplied.operationId === undefined) return reply({ error: '画面を再読み込みしてから生成してください。以前の操作を自動で再実行することはありません。', code: 'OPERATION_REQUIRED' }, 409)
    if (typeof supplied.operationId !== 'string' || !uuid.test(supplied.operationId)) throw new DoyaSlideOperationError(400, 'INVALID_OPERATION', '操作内容を確認してください。')
    let projectId: string | undefined
    if (binding && binding.kind !== 'batch') {
      if (!identifier(binding.slideId)) throw new DoyaSlideOperationError(400, 'INVALID_OPERATION', '操作対象を確認してください。')
      const owned = await prisma.doyaSlideSlide.findFirst({ where: { id: binding.slideId, project: { userId: actor } }, select: { projectId: true } })
      if (!owned) return reply({ error: 'スライドを確認できません。' }, 404)
      projectId = owned.projectId
    }
    // Core validation runs before any quota/receipt write or provider request.
    const input = { ...body, actor, ...(binding ? { kind: binding.kind, ...(binding.kind !== 'batch' ? { slideId: binding.slideId, projectId } : {}) } : {}) } as DoyaSlideOperationInput
    operationId = typeof input.operationId === 'string' ? input.operationId : undefined
    return operationReply(input, await runDoyaSlideOperation(input))
  } catch (error) {
    if (error instanceof DoyaSlideOperationError) return reply({ error: error.message, code: error.code }, error.status)
    return reply({ error: '処理結果を確認できませんでした。再生成せず保存結果を確認してください。', code: 'RESULT_UNCONFIRMED', ...(operationId ? { operationId, state: 'unknown' } : {}) }, 503)
  }
}

export async function readDoyaSlideOperation(req: NextRequest, cancelMissing: boolean) {
  try {
    const actor = await getUserId()
    if (!actor) return reply({ error: 'ログインが必要です。' }, 401)
    const params = req.nextUrl.searchParams
    const allowed = new Set(['operationId', 'projectId', 'kind', 'slideId'])
    if ([...params.keys()].some(key => !allowed.has(key) || params.getAll(key).length !== 1)) {
      return reply({ error: '操作内容を確認してください。', code: 'INVALID_OPERATION' }, 400)
    }
    const kind = params.get('kind')
    if (kind !== 'batch' && kind !== 'regenerate' && kind !== 'chat') {
      return reply({ error: '操作内容を確認してください。', code: 'INVALID_OPERATION' }, 400)
    }
    const input: DoyaSlideOperationInput = {
      actor, kind, operationId: params.get('operationId') ?? '', projectId: params.get('projectId') ?? '',
      ...(params.has('slideId') ? { slideId: params.get('slideId')! } : {}),
    }
    const result = await recoverDoyaSlideOperation(input, cancelMissing)
    // Recovery exposes saved outputs, never the private input or internal quota ledger.
    return operationReply(input, result)
  } catch (error) {
    if (error instanceof DoyaSlideOperationError) return reply({ error: error.message, code: error.code }, error.status)
    return reply({ error: '保存結果を確認できませんでした。再生成せず、しばらくしてから再確認してください。', code: 'RECOVERY_UNAVAILABLE' }, 503)
  }
}
