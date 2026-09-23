import type { createPendingWork } from './pending-work'

/** In-memory only: retain the original upload closure (including blob/language).
 * A successful upload is removed; concurrent retry clicks share one attempt.
 */
export function createFinalAudioRetry(work: ReturnType<typeof createPendingWork>, changed: () => void) {
  const entries = new Map<string, { send: () => Promise<void>; failed: boolean; flight?: Promise<boolean> }>()
  function attempt(key: string): Promise<boolean> {
    const entry = entries.get(key)
    if (!entry) return Promise.resolve(true)
    if (entry.flight) return entry.flight
    entry.failed = false
    entry.flight = Promise.resolve().then(entry.send).then(() => {
      work.resolve(key)
      entries.delete(key)
      return true
    }, () => {
      entry.failed = true
      work.fail(key)
      return false
    }).finally(() => { entry.flight = undefined; changed() })
    changed()
    return entry.flight
  }
  return {
    run(key: 'remote' | 'self', send: () => Promise<void>) {
      const id = `final-audio:${key}`
      if (!entries.has(id)) entries.set(id, { send, failed: false })
      return attempt(id)
    },
    async retry() {
      const results = await Promise.all([...entries.keys()].map(attempt))
      return results.every(Boolean)
    },
    hasPending: () => entries.size > 0,
    failedCount: () => [...entries.values()].filter(entry => entry.failed).length,
    isBusy: () => [...entries.values()].some(entry => !!entry.flight),
  }
}
