// ============================================
// ドヤカンニング 自動回答の間引き
// ============================================
// 自動回答は AUTO_ANSWER_MIN_INTERVAL_MS に1件まで。
// 間隔内に来た発話は捨てずに1件へまとめ、間隔が空いた時点で1回だけ送る。
// 長くなりすぎた分は古い方から切る（直近の発話ほど答える価値が高いため）。

export const AUTO_ANSWER_MERGED_MAX_CHARS = 600

export interface AutoAnswerThrottleOptions {
  intervalMs: number
  send: (text: string) => void
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export interface AutoAnswerThrottle {
  /** 発話を受け取る。送れるなら即送り、送れないなら次の送信へまとめる */
  submit: (text: string) => void
  /** 待っている発話を捨てる（録音停止・画面を離れるとき） */
  cancel: () => void
  /** テスト・表示用: まとめ待ちの文 */
  pending: () => string
}

export function createAutoAnswerThrottle(opts: AutoAnswerThrottleOptions): AutoAnswerThrottle {
  const now = opts.now ?? (() => Date.now())
  const setTimer = opts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer = opts.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>))
  let lastSentAt = -Infinity
  let queued = ''
  let timer: unknown = null

  const fire = () => {
    timer = null
    const text = queued
    queued = ''
    if (!text) return
    lastSentAt = now()
    opts.send(text)
  }

  return {
    submit(text) {
      const t = text.trim()
      if (!t) return
      const wait = lastSentAt + opts.intervalMs - now()
      if (wait <= 0 && timer === null) {
        lastSentAt = now()
        opts.send(t)
        return
      }
      const merged = queued ? `${queued} ${t}` : t
      queued = merged.length > AUTO_ANSWER_MERGED_MAX_CHARS ? merged.slice(-AUTO_ANSWER_MERGED_MAX_CHARS) : merged
      if (timer === null) timer = setTimer(fire, Math.max(0, wait))
    },
    cancel() {
      if (timer !== null) clearTimer(timer)
      timer = null
      queued = ''
    },
    pending: () => queued,
  }
}
