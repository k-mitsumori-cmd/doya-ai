'use client'

// ドヤ支出管理: クライアントから API を呼ぶ小さな部品
import { useCallback, useEffect, useRef, useState } from 'react'
import { requestOrgJson } from '@/lib/org-client-response'

/** API の失敗。HTTP ステータスと code を持つ（403 は権限なしとして扱う） */
export class ExpenseApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
    this.name = 'ExpenseApiError'
  }
}
export const isForbidden = (e: unknown) => e instanceof ExpenseApiError && e.status === 403

const FALLBACK_ERROR = '処理に失敗しました。時間をおいて再度お試しください。'
/** 日本語の文だけを画面に出す（英語の文や内部の言葉はそのまま出さない） */
const isJapanese = (v: string) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(v)

/** 失敗したら API の error メッセージで Error を投げる */
export async function expenseApi<T = any>(path: string, orgSlug: string, init: RequestInit = {}): Promise<T> {
  const { res, data } = await requestOrgJson('expense', path, orgSlug, init)
  if (!res.ok) {
    const msg = typeof data.error === 'string' && data.error && isJapanese(data.error) ? data.error : FALLBACK_ERROR
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

/** 一覧・詳細の取得（path が変わると取り直す。reload() で再取得）
 * 条件（path・orgSlug）が変わったら、前の条件の結果とエラーをすぐ消す（前の月の合計などを残さない）。
 * 古い要求は AbortController で止め、遅れて返っても新しい条件の結果を上書きしない。 */
export function useExpenseQuery<T = any>(path: string | null, orgSlug: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const keyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!path || !orgSlug) return
    const key = `${orgSlug}\n${path}`
    if (keyRef.current !== key) {
      // 条件が変わった（reload ではない）。前の結果を出し続けない
      keyRef.current = key
      setData(null)
      setError(null)
      setForbidden(false)
    }
    const controller = new AbortController()
    setLoading(true)
    expenseApi<T>(path, orgSlug, { signal: controller.signal })
      .then((d) => {
        if (controller.signal.aborted) return
        setData(d)
        setError(null)
        setForbidden(false)
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setError(e instanceof Error && e.message ? e.message : FALLBACK_ERROR)
        setForbidden(isForbidden(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [path, orgSlug, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, forbidden, loading, reload }
}

/** 書き込みの二度押しを防ぐ。run の実行中は次の run を無視し、busy に実行中の key を持つ */
export function useBusyAction() {
  const running = useRef(false)
  const [busy, setBusy] = useState<string | null>(null)
  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    if (running.current) return
    running.current = true
    setBusy(key)
    try {
      await fn()
    } finally {
      running.current = false
      setBusy(null)
    }
  }, [])
  return { busy, run }
}
