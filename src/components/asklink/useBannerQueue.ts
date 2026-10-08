'use client'

// バナーを1枚ずつ順に作る（1リクエスト1枚。maxDuration=300 に収めるため、まとめて作らない）
import { useCallback, useRef, useState } from 'react'
import type { RunDto } from '@/lib/asklink/dto'

export function useBannerQueue(setRun: (run: RunDto) => void) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)

  const generate = useCallback(
    async (runId: string, kinds: string[]) => {
      if (running.current) return
      running.current = true
      setError(null)
      try {
        for (const kind of kinds) {
          setBusy(kind)
          const res = await fetch(`/api/asklink/runs/${runId}/banners/${kind}`, { method: 'POST' })
          const data = await res.json().catch(() => ({}))
          if (data?.run) setRun(data.run)
          if (!res.ok) {
            setError(data?.error || 'バナーの作成に失敗しました。')
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

  return { busy, error, generate }
}
