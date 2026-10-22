'use client'

// バナーを1枚ずつ順に作る（1リクエスト1枚。maxDuration=300 に収めるため、まとめて作らない）
import { useCallback, useRef, useState } from 'react'
import type { RunDto } from '@/lib/asklink/dto'

export function useBannerQueue(setRun: (run: RunDto) => void) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 新しい見た目では、文言ではなく状態から案内を決める（errors.ts）
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const running = useRef(false)

  const generate = useCallback(
    async (runId: string, kinds: string[]) => {
      if (running.current) return
      running.current = true
      setError(null)
      setErrorStatus(null)
      try {
        for (const kind of kinds) {
          setBusy(kind)
          const res = await fetch(`/api/asklink/runs/${runId}/banners/${kind}`, { method: 'POST' }).catch(() => null)
          if (!res) {
            // 通信そのものの失敗。残りは作らずに止める（今の見た目の error は前のまま出さない）
            setErrorStatus(0)
            break
          }
          const data = await res.json().catch(() => ({}))
          if (data?.run) setRun(data.run)
          if (!res.ok) {
            setError(data?.error || 'バナーの作成に失敗しました。')
            setErrorStatus(res.status)
            if (res.status === 401) break
          }
          window.dispatchEvent(new Event('asklink:generated'))
        }
      } finally {
        setBusy(null)
        running.current = false
      }
    },
    [setRun]
  )

  return { busy, error, errorStatus, generate }
}
