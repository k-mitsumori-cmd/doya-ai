'use client'
// ============================================
// ツールの画面で、ドヤAIが渡した値を、最初に1回だけ入力欄へ入れる
// ============================================
// 使い方: useDoyaPrefill((read) => { const u = read('url', 'url'); if (u) setUrl(u) })
// - 値は URL に載っていない。URL の一度きりの鍵（?doya_k=）で、同じタブの sessionStorage から1回だけ取り出す（取り出したら消す）。
// - 読んだら、URL から鍵を消す（history.replaceState）。分析の送り先に鍵も残さない。
// - 鍵が無い・期限切れ・旗が off で誰も値を入れていないときは、何もしない。
// ⚠️ 読むのは画面を開いた最初の1回だけ（入力中に上書きしない）。値の形は normalizeValue が確かめる。
// ⚠️ サーバーの描画と食い違わないよう、描画のあと（useEffect）で入れる。
import { useEffect, useRef } from 'react'
import { PREFILL_KEY_PARAM, normalizeValue, takePrefill } from '@/lib/agent-router/prefill'
import type { AgentFieldType } from '@/lib/agent-router/types'

export function useDoyaPrefill(apply: (read: (key: string, type?: AgentFieldType) => string) => void): void {
  const done = useRef(false)
  const applyRef = useRef(apply)
  applyRef.current = apply
  useEffect(() => {
    if (done.current || typeof window === 'undefined') return
    done.current = true
    let url: URL
    try { url = new URL(window.location.href) } catch { return }
    const key = url.searchParams.get(PREFILL_KEY_PARAM)
    if (!key) return
    // 鍵は読んだらすぐ URL から消す（戻る・共有・分析に残さない）
    url.searchParams.delete(PREFILL_KEY_PARAM)
    try { window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash) } catch { /* 消せなくても値は出さない */ }
    let storage: Storage | null = null
    try { storage = window.sessionStorage } catch { storage = null }
    const values = takePrefill(key, storage)
    if (!Object.keys(values).length) return
    applyRef.current((k, type = 'text') => normalizeValue(type, values[k]))
  }, [])
}
