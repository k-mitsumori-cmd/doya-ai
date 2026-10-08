'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { readStylePreview } from './style-preview-client'

type Preview = { urls: string[]; status: 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'capped'; message: string }
const IDLE: Preview = { urls: [], status: 'idle', message: '' }
const WAIT_MS = 420_000
const POLL_MS = 10_000
const MAX_POLLS = 36
const unavailable = '見本を取得できませんでした。見本なしでも資料を作成できます。'

export function useStylePreviews(identity: string, styles: readonly string[]) {
  function makeScope() {
    return { identity, active: false, autoDeadline: Date.now() + WAIT_MS,
      entries: new Map<string, Preview>(), deadlines: new Map<string, number>(), attempts: new Map<string, number>(),
      requests: new Map<string, { controller: AbortController; promise: Promise<void> }>(),
      timers: new Map<string, ReturnType<typeof setTimeout>>() }
  }
  const scopeRef = useRef<ReturnType<typeof makeScope> | null>(null)
  if (scopeRef.current?.identity !== identity) scopeRef.current = makeScope()
  const scope = scopeRef.current
  const [view, setView] = useState<{ scope: typeof scope; entries: Record<string, Preview> }>({ scope, entries: {} })
  const ensure = useCallback(async function request(style: string, retry = false): Promise<void> {
    const current = () => scopeRef.current === scope && scope.active
    if (!current() || !styles.includes(style)) return
    const existing = scope.requests.get(style)
    if (existing) return existing.promise
    if (scope.timers.has(style) && !retry) return
    const previous = scope.entries.get(style) || IDLE
    if (!retry && ['ready','empty','error','capped'].includes(previous.status)) return
    if (retry) {
      clearTimeout(scope.timers.get(style)); scope.timers.delete(style)
      scope.attempts.set(style,0); scope.deadlines.set(style,Date.now()+WAIT_MS)
    }
    const deadline = scope.deadlines.get(style) ?? scope.autoDeadline
    scope.deadlines.set(style,deadline)
    const show = (next: Preview) => {
      if (!current()) return
      scope.entries.set(style,next)
      setView({ scope, entries: Object.fromEntries(scope.entries) })
    }
    if (Date.now() >= deadline || (scope.attempts.get(style) ?? 0) >= MAX_POLLS) {
      show({ ...previous, status:'error', message:'見本の準備状況を確認できません。しばらく待って再確認してください。資料の作成は続けられます。' }); return
    }
    const controller = new AbortController()
    show({ ...previous, status:'loading', message:'' })
    // Defer transport until the request is registered, so same-frame calls coalesce too.
    const promise = Promise.resolve().then(async () => {
      try {
        if (!current() || controller.signal.aborted) return
        scope.attempts.set(style,(scope.attempts.get(style) ?? 0)+1)
        const result = await readStylePreview(style,controller.signal,deadline-Date.now())
        if (!current() || controller.signal.aborted) return
        const urls = result.urls.length ? result.urls : previous.urls
        if (result.capped) { show({ urls, status:'capped', message:'本日の見本取得枠に達しました。既存の見本や、見本なしで資料を作成できます。' }); return }
        if (!result.pending) {
          show({ urls, status:urls.length?'ready':'empty', message:urls.length?'':'このスタイルの見本はまだ表示できません。見本なしでも資料を作成できます。' }); return
        }
        show({ urls, status:'loading', message:'見本を準備中です。資料の作成は先に進められます。' })
        if (deadline-Date.now() <= POLL_MS || (scope.attempts.get(style) ?? 0) >= MAX_POLLS) {
          show({ urls, status:'error', message:'見本の準備状況を確認できません。しばらく待って再確認してください。資料の作成は続けられます。' }); return
        }
        scope.timers.set(style,setTimeout(() => {
          scope.timers.delete(style)
          if (current()) void request(style)
        },POLL_MS))
      } catch {
        if (current() && !controller.signal.aborted) show({ ...previous, status:'error', message:unavailable })
      } finally {
        if (scope.requests.get(style)?.controller === controller) scope.requests.delete(style)
      }
    })
    scope.requests.set(style,{ controller, promise })
    return promise
  }, [scope, styles])

  useEffect(() => {
    scope.active = true
    let cancelled = false
    void (async () => { for (const style of styles) { if (cancelled) break; await ensure(style) } })()
    return () => {
      cancelled = true; scope.active = false
      for (const request of scope.requests.values()) request.controller.abort()
      scope.requests.clear()
      for (const timer of scope.timers.values()) clearTimeout(timer)
      scope.timers.clear()
    }
  }, [scope, styles, ensure])
  const entries = view.scope === scope ? view.entries : {}
  return { entries, ensure, retry: (style: string) => ensure(style,true) }
}
