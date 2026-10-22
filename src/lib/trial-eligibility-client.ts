export type TrialPrincipal = { kind: 'guest' } | { kind: 'authenticated'; actorId: string }
export type TrialRead = { kind: 'confirmed'; value: boolean; expires: number } | { kind: 'reauth' } | { kind: 'unknown' }
const CACHE_MS = 60_000
const MAX_BYTES = 16 * 1024
const DEADLINE_MS = 15_000

// A reader belongs to exactly one committed provider epoch.
export function createTrialEligibilityReader(principal: TrialPrincipal) {
  let active = true
  let sequence = 0
  let confirmed: Extract<TrialRead, { kind: 'confirmed' }> | null = null
  let pending: Promise<TrialRead> | null = null
  let unknownUntil = 0
  const controllers = new Set<AbortController>()
  const current = (request: number) => active && request === sequence

  async function readEligibility(request: number, controller: AbortController): Promise<TrialRead> {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const unknown: TrialRead = { kind: 'unknown' }
    // AbortSignal alone does not settle a fetch or reader that ignores abort.
    const retired = new Promise<TrialRead>(resolve => {
      controller.signal.addEventListener('abort', () => resolve(unknown), { once: true })
    })
    const deadline = new Promise<TrialRead>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(unknown) }, DEADLINE_MS)
    })
    const work = (async (): Promise<TrialRead> => {
      const params = new URLSearchParams({ expectedKind: principal.kind })
      if (principal.kind === 'authenticated') params.set('expectedActor', principal.actorId)
      if (!current(request)) return unknown
      const response = await fetch(`/api/stripe/trial-eligibility?${params}`, { cache: 'no-store', signal: controller.signal })
      if (!current(request) || controller.signal.aborted) return unknown
      if (response.status === 401 || response.status === 409) return { kind: 'reauth' }
      if (!response.ok || !response.body) return unknown
      const length = response.headers.get('content-length')
      if (length !== null && Number(length) > MAX_BYTES) return unknown
      reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const chunk = await reader.read()
        if (!current(request) || controller.signal.aborted) return unknown
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > MAX_BYTES) return unknown
        chunks.push(chunk.value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (!current(request) || controller.signal.aborted || !data || typeof data !== 'object' || Array.isArray(data)) return unknown
      const dto = data as Record<string, unknown>
      const actual = dto.principal
      if (dto.version !== 1 || typeof dto.eligible !== 'boolean' || dto.code !== undefined || dto.error !== undefined ||
          !actual || typeof actual !== 'object' || Array.isArray(actual)) return unknown
      const returned = actual as Record<string, unknown>
      if (principal.kind === 'guest' ? returned.kind !== 'guest' || returned.actorId !== undefined :
          returned.kind !== 'authenticated' || returned.actorId !== principal.actorId) return unknown
      return { kind: 'confirmed', value: dto.eligible, expires: Date.now() + CACHE_MS }
    })()
    try { return await Promise.race([work, deadline, retired]) } catch { return unknown } finally {
      clearTimeout(timer)
      controller.abort()
      if (reader) { try { void reader.cancel().catch(() => {}) } catch {} }
    }
  }

  return {
    peek(): TrialRead | null {
      if (!active || !confirmed || confirmed.expires <= Date.now()) return null
      return confirmed
    },
    read(): Promise<TrialRead> {
      if (!active) return Promise.resolve({ kind: 'unknown' })
      if (confirmed && confirmed.expires > Date.now()) return Promise.resolve(confirmed)
      confirmed = null
      if (pending) return pending
      if (unknownUntil > Date.now()) return Promise.resolve({ kind: 'unknown' })
      const request = ++sequence
      const controller = new AbortController()
      controllers.add(controller)
      const promise = readEligibility(request, controller).then(result => {
        if (!current(request)) return { kind: 'unknown' } as TrialRead
        if (result.kind === 'confirmed') confirmed = result
        else if (result.kind === 'unknown') unknownUntil = Date.now() + 1_000
        return result
      }).finally(() => {
        controllers.delete(controller)
        if (pending === promise) pending = null
      })
      pending = promise
      return promise
    },
    retire() {
      active = false
      sequence++
      confirmed = null
      pending = null
      unknownUntil = 0
      for (const controller of controllers) controller.abort()
      controllers.clear()
    },
  }
}
