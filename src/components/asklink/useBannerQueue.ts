'use client'

// 別の結果も待ち行列に残し、バナーは1リクエスト1枚ずつ作る。
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { RunDto } from '@/lib/asklink/dto'

type QueueState = { pending: number; busy: string | null; error: string | null; errorStatus: number | null }
type Job = { runId: string; kind: string; key: string; group: symbol; resolve: () => void }
const emptyState: QueueState = { pending: 0, busy: null, error: null, errorStatus: null }

export function useBannerQueue(setRun: Dispatch<SetStateAction<RunDto | null>>, activeRunId: string | null | undefined) {
  const [states, setStates] = useState<Record<string, QueueState>>({})
  const jobs = useRef<Job[]>([])
  const keys = useRef(new Set<string>())
  const running = useRef(false)
  const update = useCallback((runId: string, change: (state: QueueState) => QueueState) => {
    setStates((current) => ({ ...current, [runId]: change(current[runId] ?? emptyState) }))
  }, [])

  const drain = useCallback(async () => {
    if (running.current) return
    running.current = true
    try {
      while (jobs.current.length) {
        const job = jobs.current.shift()!
        const { runId, kind } = job
        let stopGroup = false
        update(runId, (state) => ({ ...state, busy: kind }))
        try {
          const res = await fetch(`/api/asklink/runs/${runId}/banners/${kind}`, { method: 'POST' }).catch(() => null)
          if (!res) {
            update(runId, (state) => ({ ...state, errorStatus: 0 }))
            stopGroup = true
          } else {
            const data = await res.json().catch(() => ({}))
            const returned = data?.run
            const banner = returned?.id === runId && Array.isArray(returned.banners)
              ? (returned.banners as RunDto['banners']).find((item) => item?.kind === kind)
              : null
            if (res.ok && !banner) {
              update(runId, (state) => ({ ...state, errorStatus: 0 }))
              stopGroup = true
            } else {
              if (banner) {
                // 遅れた応答では質問文・別のバナー・表示中の別の結果を戻さない。
                setRun((current) => {
                  if (!current || current.id !== runId) return current
                  return { ...current, banners: current.banners.map((item) => item.kind === kind ? banner : item) }
                })
              }
              if (!res.ok) {
                update(runId, (state) => ({ ...state, error: data?.error || 'バナーの作成に失敗しました。', errorStatus: res.status }))
                stopGroup = res.status === 401
              }
              window.dispatchEvent(new Event('asklink:generated'))
            }
          }
        } finally {
          keys.current.delete(job.key)
          let removed = 1
          if (stopGroup) {
            // 成否が分からない通信は自動再試行しない。同じ呼び出しの残りだけ止める。
            jobs.current = jobs.current.filter((queued) => {
              if (queued.group !== job.group) return true
              keys.current.delete(queued.key)
              queued.resolve()
              removed++
              return false
            })
          }
          update(runId, (state) => ({ ...state, pending: state.pending - removed, busy: null }))
          job.resolve()
        }
      }
    } finally {
      running.current = false
    }
  }, [setRun, update])

  const generate = useCallback(async (runId: string, kinds: string[]) => {
    const group = Symbol()
    const completions: Promise<void>[] = []
    for (const kind of kinds) {
      const key = JSON.stringify([runId, kind])
      if (keys.current.has(key)) continue
      keys.current.add(key)
      completions.push(new Promise<void>((resolve) => jobs.current.push({ runId, kind, key, group, resolve })))
    }
    if (!completions.length) return
    update(runId, (state) => ({ ...state, pending: state.pending + completions.length, error: null, errorStatus: null }))
    void drain()
    await Promise.all(completions)
  }, [drain, update])

  const state = activeRunId ? states[activeRunId] ?? emptyState : emptyState
  return { busy: state.busy, pending: state.pending > 0, error: state.error, errorStatus: state.errorStatus, generate }
}
