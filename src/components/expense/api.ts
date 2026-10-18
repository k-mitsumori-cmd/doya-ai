'use client'

// ドヤ支出管理: クライアントから API を呼ぶ小さな部品
import { useCallback, useEffect, useState } from 'react'
import { requestOrgJson } from '@/lib/org-client-response'

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
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!path || !orgSlug) return
    let alive = true
    setLoading(true)
    expenseApi<T>(path, orgSlug)
      .then((d) => {
        if (!alive) return
        setData(d)
        setError(null)
        setForbidden(false)
      })
      .catch((e: Error) => {
        if (!alive) return
        setError(e.message)
        setForbidden(isForbidden(e))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [path, orgSlug, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, forbidden, loading, reload }
}
