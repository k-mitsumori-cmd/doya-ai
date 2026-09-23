type Timer = ReturnType<typeof setTimeout>
export class CunningRecordingError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message)
    this.name = 'CunningRecordingError'
  }
}
type Options = {
  requestKey: string
  onStop: () => void
  onError?: (error: Error) => void
  fetch?: typeof fetch
  now?: () => number
  schedule?: typeof setTimeout
  cancel?: typeof clearTimeout
}

/** Owns the native recording lease, not media permissions or audio uploads.
 * Relative grants are measured against a monotonic browser clock. Subtracting
 * the entire round trip is conservative and does not trust the device date.
 */
export function createCunningRecordingClient(sessionId: string, options: Options) {
  const request = options.fetch ?? fetch
  const now = options.now ?? (() => performance.now())
  const schedule = options.schedule ?? setTimeout
  const cancel = options.cancel ?? clearTimeout
  let token: string | null = null
  let deadline = 0
  let halted = false
  let stopConfirmed = false
  let starting: Promise<string> | null = null
  let stopping: Promise<void> | null = null
  let heartbeatTimer: Timer | undefined
  let expiryTimer: Timer | undefined

  function clearTimers() {
    if (heartbeatTimer !== undefined) cancel(heartbeatTimer)
    if (expiryTimer !== undefined) cancel(expiryTimer)
    heartbeatTimer = expiryTimer = undefined
  }

  async function send(body: object, keepalive = false) {
    const controller = new AbortController()
    let timer: Timer | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = schedule(() => { controller.abort(); reject(new Error('録音状態の確認がタイムアウトしました')) }, 10000)
    })
    try {
      return await Promise.race([(async () => {
        const response = await request(`/api/cunning/sessions/${encodeURIComponent(sessionId)}/recording`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal: controller.signal, keepalive,
        })
        const data = await response.json()
        if (!response.ok) throw new CunningRecordingError(
          typeof data?.error === 'string' ? data.error : '録音状態を確認できませんでした',
          response.status, typeof data?.code === 'string' ? data.code : undefined,
        )
        return data
      })(), timeout])
    } finally { if (timer !== undefined) cancel(timer) }
  }

  function halt() {
    clearTimers()
    if (halted) return
    halted = true
    try { options.onStop() } catch (error) { report(error) }
  }

  function accept(data: unknown, sentAt: number) {
    const grant = data as { state?: unknown; token?: unknown; validForMs?: unknown }
    if (grant?.state !== 'active' || typeof grant.token !== 'string' || !grant.token || grant.token.length > 128 ||
      typeof grant.validForMs !== 'number' || !Number.isFinite(grant.validForMs) || grant.validForMs <= 0 || grant.validForMs > 60000 ||
      (token !== null && token !== grant.token)) throw new Error('録音の許可情報が不正です')
    token = grant.token
    deadline = sentAt + grant.validForMs
    if (deadline <= now()) throw new Error('録音の許可期限が切れています')
    if (halted) return
    clearTimers()
    const remaining = deadline - now()
    expiryTimer = schedule(() => { void stop().catch(report) }, remaining)
    heartbeatTimer = schedule(() => { void heartbeat() }, Math.min(20000, remaining / 2))
  }

  function report(error: unknown) {
    options.onError?.(error instanceof Error ? error : new Error('録音を継続できませんでした'))
  }

  async function heartbeat() {
    if (halted || !token) return
    const sentAt = now()
    try {
      const data = await send({ action: 'heartbeat', token })
      if (halted) return // A late response must never restart stopped media.
      if (now() >= deadline) throw new Error('録音の許可期限が切れています')
      accept(data, sentAt)
    } catch (error) {
      report(error)
      await stop().catch(report)
    }
  }

  function start(): Promise<string> {
    if (halted) return Promise.reject(new Error('終了した録音は再開できません'))
    if (starting) return starting
    if (token) {
      if (now() >= deadline) {
        void stop().catch(report)
        return Promise.reject(new Error('録音の許可期限が切れています'))
      }
      return Promise.resolve(token)
    }
    const sentAt = now()
    starting = (async () => {
      const data = await send({ action: 'start', requestKey: options.requestKey })
      accept(data, sentAt)
      if (halted) throw new Error('録音開始はキャンセルされました')
      return token!
    })().catch(async error => {
      if (token && !halted) {
        halt()
        try {
          const result = await send({ action: 'stop', token }, true)
          stopConfirmed = result?.state === 'stopped'
        } catch (stopError) { report(stopError) }
      }
      throw error
    }).finally(() => { starting = null })
    return starting
  }

  function stop(): Promise<void> {
    halt() // Stop capture immediately; do not charge time spent draining AI jobs.
    if (stopConfirmed) return Promise.resolve()
    if (stopping) return stopping
    stopping = (async () => {
      if (starting) await starting.catch(() => {})
      if (stopConfirmed) return
      if (!token) return // An unknown grant can only survive until server expiry.
      const result = await send({ action: 'stop', token }, true)
      if (result?.state !== 'stopped') throw new Error('録音の停止を確認できませんでした')
      stopConfirmed = true
    })().finally(() => { stopping = null })
    return stopping
  }

  return { start, stop, token: () => token, remainingMs: () => halted ? 0 : Math.max(0, deadline - now()) }
}
