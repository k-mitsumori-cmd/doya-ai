import { assembleHrEvaluationDetail, HR_DETAIL_PACKET_BYTES } from '@/lib/hr/evaluation-detail-transfer'
class HrDetailHttpError extends Error {
  constructor(public readonly status: number, public readonly data: unknown) { super('評価を完全に取得できませんでした。') }
}
/** Bound each wire response and its deadline. Never retry a read or publish an incomplete snapshot. */
export async function readHrEvaluationDetailResponse(url: string, init: RequestInit, signal?: AbortSignal, transport: typeof fetch = fetch): Promise<{ status: number; data: unknown }> {
  if ((init.method || 'GET') !== 'GET') throw Error('評価の取得方法を確認してください。')
  const path = url.split('?')[0], match = /^\/api\/hr\/evaluations\/([^/]+)$/.exec(path)
  if (!match) throw Error('評価の取得先を確認してください。')
  const evaluationId = decodeURIComponent(match[1]), expectedOrganization = new Headers(init.headers).get('X-HR-Organization-Id') || undefined
  const read = async (cursor: string | null) => {
    const controller = new AbortController(), parents = [signal, init.signal].filter((s): s is AbortSignal => Boolean(s))
    const abort = () => controller.abort()
    let timer: ReturnType<typeof setTimeout> | undefined, cancelBody: (() => void) | undefined, stopped: (() => void) | undefined
    for (const parent of parents) { parent.addEventListener('abort', abort, { once: true }); if (parent.aborted) abort() }
    try {
      if (controller.signal.aborted) throw Error('操作が中断されました。')
      const interrupted = new Promise<never>((_, reject) => {
        stopped = () => reject(Error('評価の応答を確認できませんでした。'))
        controller.signal.addEventListener('abort', stopped, { once: true })
        timer = setTimeout(abort, 35000)
      })
      return await Promise.race([interrupted, (async () => {
        const query = new URLSearchParams({ format: 'editor-packets', ...(cursor === null ? {} : { cursor }) })
        const response = await transport(path + '?' + query, { ...init, cache: 'no-store', signal: controller.signal })
        if (!response.body || controller.signal.aborted) throw Error('評価の応答を確認できませんでした。')
        const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
        cancelBody = () => { void reader.cancel().catch(() => {}) }
        controller.signal.addEventListener('abort', cancelBody, { once: true })
        let bytes = 0, text = ''
        try {
          while (true) {
            if (controller.signal.aborted) throw Error('操作が中断されました。')
            const chunk = await reader.read()
            if (chunk.done) break
            bytes += chunk.value.byteLength
            if (bytes > HR_DETAIL_PACKET_BYTES) throw Error('評価の応答を確認できませんでした。')
            text += decoder.decode(chunk.value, { stream: true })
          }
          text += decoder.decode()
          const data: unknown = JSON.parse(text)
          if (response.status !== 200) throw new HrDetailHttpError(response.status, data)
          return data
        } finally { void reader.cancel().catch(() => {}) }
      })()])
    } finally {
      if (timer !== undefined) clearTimeout(timer)
      if (cancelBody) controller.signal.removeEventListener('abort', cancelBody)
      if (stopped) controller.signal.removeEventListener('abort', stopped)
      for (const parent of parents) parent.removeEventListener('abort', abort)
    }
  }
  try { return { status: 200, data: await assembleHrEvaluationDetail(evaluationId, expectedOrganization, read, signal || init.signal || undefined) } }
  catch (error) { if (error instanceof HrDetailHttpError) return { status: error.status, data: error.data }; throw error }
}
