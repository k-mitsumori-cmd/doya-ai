'use client'

// ドヤ支出管理: クライアントから API を呼ぶ小さな部品
import { useCallback, useEffect, useRef, useState } from 'react'
import { requestOrgJson } from '@/lib/org-client-response'
import { useExpenseReadScope } from '@/lib/expense/use-read-scope'

/** API の失敗。HTTP ステータスと code を持つ（403 は権限なしとして扱う） */
export class ExpenseApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
    this.name = 'ExpenseApiError'
  }
}
export const isForbidden = (e: unknown) => e instanceof ExpenseApiError && e.status === 403

/** 失敗したら API の error メッセージで Error を投げる */
export async function expenseApi<T = any>(path: string, orgSlug: string, init: RequestInit = {}): Promise<T> {
  const { res, data } = await requestOrgJson('expense', path, orgSlug, init)
  if (!res.ok) {
    const msg = typeof data.error === 'string' && data.error ? data.error : '処理に失敗しました。時間をおいて再度お試しください。'
    throw new ExpenseApiError(msg, res.status, typeof data.code === 'string' ? data.code : undefined)
  }
  return data as T
}

export function jsonInit(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  }
}

/** 一覧・詳細の取得（path が変わると取り直す。reload() で再取得） */
export function useExpenseQuery<T = any>(path: string | null, orgSlug: string) {
  const scope = useExpenseReadScope(orgSlug, path)
  const { key, current, enabled, actor, status: sessionStatus } = scope
  type Result = { key: string; data: T | null; error: string | null; forbidden: boolean; loading: boolean; status: number | null }
  const [stored, setStored] = useState<Result | null>(null)
  const [tick, setTick] = useState(0)
  const sequence = useRef(0)

  useEffect(() => {
    if (!enabled || !path) return
    let alive = true
    const request = ++sequence.current
    const controller = new AbortController()
    const active = () => alive && !controller.signal.aborted && current() && sequence.current === request
    setStored(previous => ({ key, data: previous?.key === key ? previous.data : null, error: null, forbidden: false, loading: true, status: null }))
    expenseApi<T>(path, orgSlug, { signal: controller.signal })
      .then((d) => {
        if (!active()) return
        setStored({ key, data: d, error: null, forbidden: false, loading: false, status: null })
      })
      .catch((e: Error) => {
        if (!active()) return
        const httpStatus = (e as Error & { status?: unknown }).status
        const status = typeof httpStatus === 'number' ? httpStatus : null
        setStored({ key, data: null, error: e.message, forbidden: status === 403, loading: false, status })
      })
      .finally(() => {
        if (active()) setStored(previous => previous?.key === key ? { ...previous, loading: false } : previous)
      })
    return () => {
      alive = false
      controller.abort()
    }
  }, [path, orgSlug, tick, key, current, enabled])

  const reload = useCallback(() => { if (current()) setTick(t => t + 1) }, [current])
  const empty: Result = { key, data: null, error: null, forbidden: false, loading: sessionStatus === 'loading' || enabled, status: null }
  if (path && orgSlug && sessionStatus !== 'loading' && !enabled) {
    empty.error = actor ? '読み込みを開始できませんでした。' : 'ログイン状態を確認してください。'
    empty.status = sessionStatus === 'unauthenticated' ? 401 : null
  }
  const view = enabled && stored?.key === key ? stored : empty
  return { ...view, reload, scopeKey: key, isCurrent: current }
}
