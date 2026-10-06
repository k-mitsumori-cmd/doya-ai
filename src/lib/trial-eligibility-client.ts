export type ConfirmedTrialEligibility = { value: boolean; expires: number }
const CACHE_MS = 60_000
const MAX_BYTES = 16 * 1024
const DEADLINE_MS = 15_000
const cache = new Map<string, ConfirmedTrialEligibility>()
const pending = new Map<string, Promise<ConfirmedTrialEligibility | null>>()
// Multiple callouts may retry in separate timer callbacks after the same failure.
// Briefly coalesce unknown results without treating them as confirmed ineligible.
const unknownUntil = new Map<string, number>()

async function readEligibility(): Promise<boolean | null> {
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('Trial check timed out')) }, DEADLINE_MS)
  })
  const work = (async () => {
    const response = await fetch('/api/stripe/trial-eligibility', { cache: 'no-store', signal: controller.signal })
    if (controller.signal.aborted || !response.ok || !response.body) return null
    if (Number(response.headers.get('content-length')) > MAX_BYTES) return null
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const chunk = await reader.read()
      if (controller.signal.aborted) return null
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > MAX_BYTES) return null
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.eligible !== 'boolean' || data.code !== undefined || data.error !== undefined) return null
    return data.eligible as boolean
  })()
  try { return await Promise.race([work, deadline]) } catch { return null } finally {
    clearTimeout(timer)
    controller.abort()
    if (reader) { try { void reader.cancel().catch(() => {}) } catch {} }
  }
}

/** Unknown results are never cached as ineligible and never grant a trial. */
export function fetchTrialEligibility(key: string): Promise<ConfirmedTrialEligibility | null> {
  const confirmed = cache.get(key)
  if (confirmed && confirmed.expires > Date.now()) return Promise.resolve(confirmed)
  cache.delete(key)
  const existing = pending.get(key)
  if (existing) return existing
  if ((unknownUntil.get(key) ?? 0) > Date.now()) return Promise.resolve(null)
  unknownUntil.delete(key)
  const request = readEligibility().then(value => {
    if (value === null) {
      unknownUntil.set(key, Date.now() + 1_000)
      if (unknownUntil.size > 100) unknownUntil.delete(unknownUntil.keys().next().value!)
      return null
    }
    const result = { value, expires: Date.now() + CACHE_MS }
    cache.set(key, result)
    if (cache.size > 100) cache.delete(cache.keys().next().value!)
    return result
  }).finally(() => { if (pending.get(key) === request) pending.delete(key) })
  pending.set(key, request)
  return request
}
