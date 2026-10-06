// A database transaction may commit after the browser connection is interrupted.
export class InterviewCreationResponseError extends Error {
  constructor(message: string, public code?: string) { super(message) }
}
const UNKNOWN_RESULT = 'プロジェクトの作成結果を確認できませんでした。一覧を確認してから同じ操作を再試行してください。'

export async function readInterviewCreationResponse(url: string, init: RequestInit, unknownResultMessage = UNKNOWN_RESULT, maxResponseBytes = 65536, deadlineMs = 35000) {
  const controller = new AbortController()
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectDeadline: (reason: unknown) => void = () => {}
  const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject })
  const abort = () => { controller.abort(); void activeReader?.cancel().catch(() => {}); rejectDeadline(new InterviewCreationResponseError(unknownResultMessage)) }
  init.signal?.addEventListener('abort', abort, { once: true })
  timer = setTimeout(abort, deadlineMs)
  try {
    if (init.signal?.aborted) { abort(); return await deadline }
    return await Promise.race([deadline, (async () => {
      const res = await fetch(url, { ...init, signal: controller.signal })
      if (controller.signal.aborted) { void res.body?.cancel().catch(() => {}); throw new InterviewCreationResponseError(unknownResultMessage) }
      const maxBytes = maxResponseBytes
      const contentLength = res.headers?.get('content-length')
      if (contentLength && Number(contentLength) > maxBytes) { controller.abort(); void res.body?.cancel().catch(() => {}); throw new InterviewCreationResponseError(unknownResultMessage) }
      let text = ''
      if (res.body) {
        const reader = res.body.getReader(), decoder = new TextDecoder()
        activeReader = reader
        let bytes = 0
        try {
          for (;;) {
            const chunk = await reader.read()
            if (chunk.done) break
            bytes += chunk.value.byteLength
            if (bytes > maxBytes) { controller.abort(); throw new InterviewCreationResponseError(unknownResultMessage) }
            text += decoder.decode(chunk.value, { stream: true })
          }
          text += decoder.decode()
        } finally {
          void reader.cancel().catch(() => {})
          try { reader.releaseLock() } catch { /* A pending cancellation releases it when the read settles. */ }
          activeReader = null
        }
      } else {
        text = await res.text()
        if (new TextEncoder().encode(text).byteLength > maxBytes) throw new InterviewCreationResponseError(unknownResultMessage)
      }
      let data: any = null
      try { data = text ? JSON.parse(text) : null } catch { /* The caller must not accept unreadable success responses. */ }
      return { res, data }
    })()])
  } catch (cause) {
    if (cause instanceof InterviewCreationResponseError) throw cause
    throw new InterviewCreationResponseError(unknownResultMessage)
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', abort)
  }
}

export interface InterviewCreationAttempt { key: string; scope: string | null }

// All project creation entry points use the same receipt protocol and response checks.
export async function createInterviewProjectRequest(input: Record<string, unknown>, attempt: InterviewCreationAttempt, signal: AbortSignal): Promise<{ id: string }> {
  const preparation = await readInterviewCreationResponse('/api/interview/projects?prepareCreate=1', { cache: 'no-store', signal })
  const scope = preparation.data?.creationScope
  if (!preparation.res.ok || preparation.data?.success !== true || typeof scope !== 'string' || !/^[a-f0-9]{64}$/.test(scope)) throw new InterviewCreationResponseError('利用情報を確認できませんでした。時間を置いて再度お試しください。')
  if (attempt.scope && attempt.scope !== scope) throw new InterviewCreationResponseError('利用情報が変わりました。プロジェクト一覧を確認してから再度お試しください。', 'CREATION_SCOPE_CHANGED')
  attempt.scope = scope
  if (signal.aborted) throw new InterviewCreationResponseError(UNKNOWN_RESULT)
  const reply = await readInterviewCreationResponse('/api/interview/projects', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal,
    body: JSON.stringify({ ...input, requestKey: attempt.key, creationScope: scope }),
  })
  const data = reply.data
  if (!reply.res.ok) {
    if (reply.res.status === 429 && data?.code === 'GUEST_LIMIT') throw new InterviewCreationResponseError('ゲスト利用の上限に達しました。ログインすると追加利用できます。', 'GUEST_LIMIT')
    if (reply.res.status === 409 && data?.code === 'GUEST_SESSION_REQUIRED') throw new InterviewCreationResponseError('Cookieを有効にして、画面を開き直してください。', 'GUEST_SESSION_REQUIRED')
    if (reply.res.status === 409 && data?.code === 'CREATION_SCOPE_CHANGED') throw new InterviewCreationResponseError('利用情報が変わりました。プロジェクト一覧を確認してから再度お試しください。', 'CREATION_SCOPE_RECHECK_REQUIRED')
    if (reply.res.status === 400) throw new InterviewCreationResponseError('入力内容と文字数を確認してください。')
    if (reply.res.status === 401) throw new InterviewCreationResponseError('再度ログインしてから作成してください。', 'AUTH_REQUIRED')
    throw new InterviewCreationResponseError(UNKNOWN_RESULT)
  }
  const id = data?.project?.id
  if (data?.success !== true || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new InterviewCreationResponseError('保存先を確認できませんでした。プロジェクト一覧を確認してから同じ操作を再試行してください。')
  return { id }
}
