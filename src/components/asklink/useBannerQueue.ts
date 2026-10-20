'use client'

// バナーを1枚ずつ順に作る（1リクエスト1枚。maxDuration=300 に収めるため、まとめて作らない）
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RunDto } from '@/lib/asklink/dto'
import { parseAskLinkCreationRunResponse } from '@/lib/asklink/creation-run-response'

type Task = { token: symbol; version: number }
type View = { runId: string; token: symbol; busy: string | null; error: string | null }
const FAILURE = 'バナーの作成に失敗しました。保存済みの結果を確認してから、作り直してください。'

// null is the new-input screen; omitted preserves the history screen's single queue.
export function useBannerQueue(setRun: (run: RunDto) => void, activeRunId?: string | null) {
  const [view, setView] = useState<View | null>(null)
  const tasks = useRef(new Map<string, Task>())
  const life = useRef({ active: false, version: 0 })
  const owner = useRef({ scoped: activeRunId !== undefined, runId: activeRunId ?? null })
  owner.current.scoped = activeRunId !== undefined
  if (activeRunId !== undefined) owner.current.runId = activeRunId

  useEffect(() => {
    life.current = { active: true, version: life.current.version + 1 }
    const running = tasks.current
    return () => { life.current.active = false; running.clear() }
  }, [])

  const generate = useCallback(
    async (runId: string, kinds: string[]) => {
      if (!life.current.active || tasks.current.has(runId) || !owner.current.scoped && tasks.current.size > 0) return
      if (owner.current.scoped && owner.current.runId !== runId) return
      if (!owner.current.scoped) owner.current.runId = runId
      const task: Task = { token: Symbol(runId), version: life.current.version }
      tasks.current.set(runId, task)
      const alive = () => life.current.active && life.current.version === task.version && tasks.current.get(runId) === task
      const visible = () => alive() && owner.current.runId === runId
      const update = (values: Partial<Pick<View, 'busy' | 'error'>>) => {
        if (visible()) setView(old => ({ runId, token: task.token, busy: null, error: null, ...(old?.token === task.token ? old : {}), ...values }))
      }
      update({ error: null })
      try {
        for (const kind of kinds) {
          if (!alive()) break
          update({ busy: kind })
          const res = await fetch(`/api/asklink/runs/${runId}/banners/${kind}`, { method: 'POST' })
          if (!alive()) { void res.body?.cancel().catch(() => {}); break }
          const data = await res.json().catch(() => ({}))
          if (!alive()) break
          const run = data?.run ? parseAskLinkCreationRunResponse({ run: data.run }, runId) : null
          if (res.ok && !run) throw Error(FAILURE)
          if (run && visible()) setRun(run)
          if (!res.ok) {
            update({ error: typeof data?.error === 'string' ? data.error : FAILURE })
            if (res.status === 401) break
          }
          window.dispatchEvent(new Event('asklink:generated'))
        }
      } catch {
        update({ error: FAILURE })
      } finally {
        if (alive()) {
          update({ busy: null })
          tasks.current.delete(runId)
        }
      }
    },
    [setRun]
  )

  const current = view?.runId === owner.current.runId ? view : null
  const currentTask = current && tasks.current.get(current.runId)?.token === current.token
  return { busy: currentTask ? current.busy : null, error: current?.error ?? null, generate }
}
