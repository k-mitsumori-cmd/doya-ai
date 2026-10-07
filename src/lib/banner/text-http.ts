import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { bannerTextLimitPayload } from './text-budget'
import { BannerTextOperationError, isValidBannerTextResult, bannerTextOperationId, bannerTextFingerprint, beginBannerTextOperation, completeBannerTextOperation, failBannerTextOperation, recoverBannerTextOperation, type BannerTextKind } from './text-operation'

export function privateBannerTextJson(body: unknown, options: { status?: number } = {}) {
  return NextResponse.json(body, { ...options, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}
function stateResponse(operationId: string, state: string, result?: Record<string, unknown> | null) {
  if (state === 'completed' && result) return privateBannerTextJson({ ...result, operationId, state })
  const pending = state === 'pending'
  return privateBannerTextJson({ operationId, state, error: pending ? '処理結果を確認中です。再生成せず、保存結果を確認してください。' : 'この操作では生成を再実行できません。保存結果をご確認ください。' }, { status: pending ? 202 : state === 'missing' ? 404 : 409 })
}
function errorResponse(error: unknown, operationId?: string) {
  return privateBannerTextJson({ error: error instanceof BannerTextOperationError ? error.message : '利用状況・保存結果を確認できません。再生成せず、時間をおいて結果をご確認ください。', ...(operationId ? { operationId, state: 'unknown' } : {}) }, { status: error instanceof BannerTextOperationError ? error.status : 503 })
}
/** Provider work runs outside short transactions, exactly once for this actor/kind/UUID. */
export async function runBannerTextOperation(actor: string, kind: BannerTextKind, suppliedId: unknown, input: unknown, generate: () => Promise<Response>) {
  let operationId: string | undefined
  try {
    operationId = suppliedId === undefined ? randomUUID() : bannerTextOperationId(suppliedId)
    const inputHash = bannerTextFingerprint(input)
    const admission = await beginBannerTextOperation(actor, kind, operationId, inputHash)
    if (admission.state === 'limit') return privateBannerTextJson(bannerTextLimitPayload(admission.usage, admission.upgradeAvailable), { status: 429 })
    if (admission.state !== 'started') return stateResponse(operationId, admission.state, admission.state === 'completed' ? admission.result : null)
    let generated: Response
    try { generated = await generate() }
    catch {
      await failBannerTextOperation(actor, kind, operationId, inputHash)
      return privateBannerTextJson({ operationId, state: 'failed', error: 'AIの回答を取得できませんでした。この操作を自動で再実行することはありません。' }, { status: 500 })
    }
    if (!generated.ok) {
      await failBannerTextOperation(actor, kind, operationId, inputHash)
      return privateBannerTextJson({ operationId, state: 'failed', error: 'AIの回答を確認できませんでした。この操作を自動で再実行することはありません。' }, { status: generated.status })
    }
    let result: Record<string, unknown> | undefined
    try { result = await generated.json() as Record<string, unknown> } catch { /* Invalid output is definite, not a lost DB acknowledgement. */ }
    if (!isValidBannerTextResult(result, kind)) {
      await failBannerTextOperation(actor, kind, operationId, inputHash)
      return privateBannerTextJson({ operationId, state: 'failed', error: 'AIの回答形式を確認できませんでした。この操作を自動で再実行することはありません。' }, { status: 502 })
    }
    // Retry only persistence of the same in-memory answer, never the provider.
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return stateResponse(operationId, 'completed', await completeBannerTextOperation(actor, kind, operationId, inputHash, result)) }
      catch { /* A lost commit acknowledgement can still mean the result was saved. */ }
    }
    const saved = await recoverBannerTextOperation(actor, kind, operationId)
    return stateResponse(operationId, saved.state, saved.result)
  } catch (error) { return errorResponse(error, operationId) }
}
export async function readBannerTextOperation(actor: string, kind: BannerTextKind, request: Request, cancelMissing = false) {
  let operationId: string | undefined
  try {
    const ids = new URL(request.url).searchParams.getAll('operationId')
    if (ids.length !== 1) throw new BannerTextOperationError(400, '操作情報を確認してください。')
    operationId = bannerTextOperationId(ids[0])
    const saved = await recoverBannerTextOperation(actor, kind, operationId, cancelMissing)
    return stateResponse(operationId, saved.state, saved.result)
  } catch (error) { return errorResponse(error, operationId) }
}

/** Bound the upload while streaming, before allocating a full request or reserving quota. */
export async function readBannerTextBody(request: Request, maximum: number): Promise<{ ok: true; text: string } | { ok: false; response: Response }> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort: (() => void) | undefined
  try {
    if (Number(request.headers.get('content-length')) > maximum) throw new BannerTextOperationError(413, '入力が長すぎます。')
    if (!request.body) throw new BannerTextOperationError(400, '入力内容を確認してください。')
    reader = request.body.getReader()
    const activeReader = reader
    const stopped = new Promise<never>((_, reject) => {
      abort = () => reject(new BannerTextOperationError(408, '入力を受け取れませんでした。通信状態をご確認ください。'))
      timer = setTimeout(abort, 15000)
      request.signal.addEventListener('abort', abort, { once: true })
      if (request.signal.aborted) abort()
    })
    const reading = (async () => {
      const chunks: Uint8Array[] = []
      let length = 0
      while (true) {
        const next = await activeReader.read()
        if (next.done) break
        length += next.value.byteLength
        if (length > maximum) throw new BannerTextOperationError(413, '入力が長すぎます。')
        chunks.push(next.value)
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { throw new BannerTextOperationError(400, '入力形式が正しくありません。') }
    })()
    return { ok: true, text: await Promise.race([reading, stopped]) }
  } catch (error) { return { ok: false, response: errorResponse(error) } }
  finally {
    if (timer) clearTimeout(timer)
    if (abort) request.signal.removeEventListener('abort', abort)
    void (reader ? reader.cancel() : request.body?.cancel())?.catch(() => {})
  }
}
