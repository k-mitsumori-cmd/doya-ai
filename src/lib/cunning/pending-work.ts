/** Tracks recorder stop events and the async work they enqueue before finalization. */
export function createPendingWork() {
  const pending = new Set<Promise<unknown>>()
  let failed = false
  const failures = new Set<string>()
  return {
    fail(key?: string) { if (key) failures.add(key); else failed = true },
    resolve(key: string) { failures.delete(key) },
    hasFailures() { return failed || failures.size > 0 },
    track<T>(work: Promise<T>): Promise<T> {
      pending.add(work)
      void work.then(() => pending.delete(work), () => { failed = true; pending.delete(work) })
      return work
    },
    async drain(timeoutMs = 45000): Promise<boolean> {
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Audio finalization timed out')), timeoutMs) })
      try {
        await Promise.race([(async () => {
          while (pending.size) await Promise.allSettled([...pending])
        })(), timeout])
        return !failed && failures.size === 0
      } finally { if (timer) clearTimeout(timer) }
    },
  }
}
