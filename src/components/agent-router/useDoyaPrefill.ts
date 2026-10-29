'use client'
// ============================================
// ツールの画面で、ドヤAIが渡した値（?doya_<key>=）を、最初に1回だけ入力欄へ入れる
// ============================================
// 使い方: useDoyaPrefill((read) => { const u = read('url', 'url'); if (u) setUrl(u) })
// ⚠️ 読むのは画面を開いた最初の1回だけ（入力中に上書きしない）。値の形は readPrefill が確かめる。
// ⚠️ サーバーの描画と食い違わないよう、描画のあと（useEffect）で入れる。
import { useEffect, useRef } from 'react'
import { PREFILL_PREFIX, readPrefill } from '@/lib/agent-router/prefill'
import type { AgentFieldType } from '@/lib/agent-router/types'

export function useDoyaPrefill(apply: (read: (key: string, type?: AgentFieldType) => string) => void): void {
  const done = useRef(false)
  const applyRef = useRef(apply)
  applyRef.current = apply
  useEffect(() => {
    if (done.current || typeof window === 'undefined') return
    done.current = true
    const q = new URLSearchParams(window.location.search)
    let has = false
    q.forEach((_v, k) => { if (k.startsWith(PREFILL_PREFIX)) has = true })
    if (!has) return
    applyRef.current((key, type = 'text') => readPrefill(q, key, type))
  }, [])
}
