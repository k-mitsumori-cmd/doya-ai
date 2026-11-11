'use client'
// ============================================
// useSaveState — 保存の状態（idle / saving / saved / error）を持つ小さな共通フック
// ============================================
// 保存の処理そのもの（API 呼び出し）は呼ぶ側が持つ。ここは状態を持って、保存ボタンの表示（SaveButton）に渡すだけ。
// - run(fn): fn を実行する。実行中は saving、成功したら saved、失敗（例外）なら error。例外は握りつぶさず呼び出し元へ返す
// - fn が false を返したときは、失敗として扱う（{ ok: false } を返す書き方でも使える。ok が false のオブジェクトも失敗）
// - saved は resetMs（既定 2200ms）たつと idle に戻る。画面が消えたら、タイマーも止める
// - saving の間に run をもう一度呼んでも、2つ目は動かさない（二重送信しない）
import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** 保存の結果が失敗かどうか（false / { ok: false }） */
export function isSaveFailure(result: unknown): boolean {
  return result === false || (typeof result === 'object' && result !== null && (result as { ok?: unknown }).ok === false)
}

export function useSaveState(resetMs = 2200) {
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const busy = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; if (timer.current) clearTimeout(timer.current) }
  }, [])

  const run = useCallback(async <T,>(fn: () => Promise<T> | T): Promise<T | undefined> => {
    if (busy.current) return undefined
    busy.current = true
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setState('saving')
    try {
      const result = await fn()
      if (alive.current) {
        const failed = isSaveFailure(result)
        setState(failed ? 'error' : 'saved')
        timer.current = setTimeout(() => { if (alive.current) setState('idle') }, failed ? resetMs + 1500 : resetMs)
      }
      return result
    } catch (e) {
      if (alive.current) {
        setState('error')
        timer.current = setTimeout(() => { if (alive.current) setState('idle') }, resetMs + 1500)
      }
      throw e
    } finally {
      busy.current = false
    }
  }, [resetMs])

  /** 状態だけ手で動かしたいとき（保存の処理が別の場所にあるとき） */
  const set = useCallback((next: SaveState) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setState(next)
    if (next === 'saved' || next === 'error') {
      timer.current = setTimeout(() => { if (alive.current) setState('idle') }, next === 'saved' ? resetMs : resetMs + 1500)
    }
  }, [resetMs])

  return { state, run, set, saving: state === 'saving', saved: state === 'saved' }
}

/**
 * 保存の処理が別の場所（フックなど）にあり、saving と「成功したか」だけ分かるときの橋渡し。
 * saving が true から false に変わった瞬間に、succeeded が true なら saved、false なら idle にする。
 */
export function useSaveFlash(saving: boolean, succeeded: boolean, resetMs = 2200): SaveState {
  const [state, setState] = useState<SaveState>('idle')
  const was = useRef(false)
  const ok = useRef(succeeded)
  ok.current = succeeded
  useEffect(() => {
    if (saving) { was.current = true; setState('saving'); return }
    if (!was.current) return
    was.current = false
    if (!ok.current) { setState('idle'); return }
    setState('saved')
    const t = setTimeout(() => setState('idle'), resetMs)
    return () => clearTimeout(t)
  }, [saving, resetMs])
  return state
}

/** 「はじめての1回」を覚えるときの名前（ブラウザに1つだけ） */
export const FIRST_DONE_KEY = 'doya-first-done-v1'

/**
 * 生成が初めて完了したか（M8）。この部品が表に出た最初の1回だけ true。2回目からは false。
 * 覚えるのは localStorage（読み書きは try/catch。使えない環境では毎回 false にして、大きなお祝いを繰り返さない）。
 */
export function useFirstDone(): boolean {
  const [first, setFirst] = useState(false)
  useEffect(() => {
    try {
      if (window.localStorage.getItem(FIRST_DONE_KEY) === '1') return
      window.localStorage.setItem(FIRST_DONE_KEY, '1')
      setFirst(true)
    } catch { /* 覚えられない環境では、小さなチェックだけ */ }
  }, [])
  return first
}
