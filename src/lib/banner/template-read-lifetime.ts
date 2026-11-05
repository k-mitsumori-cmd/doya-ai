/** One mounted template-catalog reader. A new setup always receives a new scope. */
export type BannerTemplateReadScope = {
  readonly signal: AbortSignal
  current: () => boolean
  schedule: (callback: () => void, delayMs: number) => void
  wait: (delayMs: number) => Promise<boolean>
  acquireBackground: () => boolean
  releaseBackground: () => void
  cancel: () => void
}

export function createBannerTemplateReadScope(): BannerTemplateReadScope {
  const controller = new AbortController()
  const scheduled = new Set<ReturnType<typeof setTimeout>>()
  const waiting = new Map<ReturnType<typeof setTimeout>, (current: boolean) => void>()
  let active = true
  let background = false

  return {
    signal: controller.signal,
    current: () => active,
    schedule(callback, delayMs) {
      if (!active) return
      const timer = setTimeout(() => {
        scheduled.delete(timer)
        if (active) callback()
      }, delayMs)
      scheduled.add(timer)
    },
    wait(delayMs) {
      if (!active) return Promise.resolve(false)
      return new Promise(resolve => {
        const timer = setTimeout(() => {
          waiting.delete(timer)
          resolve(active)
        }, delayMs)
        waiting.set(timer, resolve)
      })
    },
    acquireBackground() {
      if (!active || background) return false
      background = true
      return true
    },
    releaseBackground() {
      background = false
    },
    cancel() {
      if (!active) return
      active = false
      background = false
      controller.abort()
      for (const timer of scheduled) clearTimeout(timer)
      scheduled.clear()
      for (const [timer, resolve] of waiting) {
        clearTimeout(timer)
        resolve(false)
      }
      waiting.clear()
    },
  }
}
