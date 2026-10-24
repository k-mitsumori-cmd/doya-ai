'use client'
// ============================================
// 「作り直す」のボタンで、前の操作のキーを retryOf として送る（5分以内なら減る量が半分）
// ============================================
// 使い方:
//   const retry = useDoyaPowerRetry(`shanai-article:${id}`)
//   const res = await fetch(url, { method: 'POST', headers: { ...retry.headers() } })   // 作り直しのときだけ付く
//   if (res.ok) retry.remember(res)                                                     // 応答のヘッダーのキーを控える
//   <ShellCostBadge action="interview.article" retry={retry.halved} />
// 決まり:
// - 旗（useDoyaPower()）が出さないと決めた人には、何も控えず、何も送らない（今までと同じリクエスト）
// - 半分にするかを決めるのはサーバー（src/lib/doya-power/charge-core.ts）。ここは前のキーを送るのと、札の目安だけ
// - 控えは画面と対象ごと（slot）。sessionStorage に残すので、ページを移っても・読み込み直しても5分以内なら使える
import { useCallback, useEffect, useState } from 'react'
import { useDoyaPower } from './doya-power-context'
import { createRetryMemory, DOYA_POWER_OP_HEADER, DOYA_POWER_RETRY_HEADER } from '@/lib/doya-power/retry'

const memory = createRetryMemory({ storage: () => (typeof window === 'undefined' ? null : window.sessionStorage) })

export function useDoyaPowerRetry(slot: string | null | undefined) {
  const enabled = useDoyaPower()
  // sessionStorage はサーバーの描画には無いので、画面に出てから読む（描画の食い違いを出さない）
  const [mounted, setMounted] = useState(false)
  const [version, setVersion] = useState(0)
  useEffect(() => setMounted(true), [])
  const active = enabled && mounted && !!slot
  const remaining = active ? memory.remainingMs(slot) : 0
  const halved = remaining > 0
  // 5分を過ぎたら、札を全額に戻す
  useEffect(() => {
    if (!halved) return
    const t = window.setTimeout(() => setVersion((v) => v + 1), remaining + 50)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halved, slot, version])

  /** 作り直しに送る前の操作のキー。無ければ null（送らない） */
  const retryOf = useCallback((): string | null => (enabled && slot ? memory.retryOf(slot) : null), [enabled, slot])

  /** リクエストに足すヘッダー。作り直しでなければ空 */
  const headers = useCallback((): Record<string, string> => {
    const k = retryOf()
    return k ? { [DOYA_POWER_RETRY_HEADER]: k } : {}
  }, [retryOf])

  /** 成功した応答（のヘッダー）か、クライアントが持っている操作のキーを控える。旗が off なら何もしない */
  const remember = useCallback((from: Response | string | null | undefined) => {
    if (!enabled || !slot || !from) return
    const key = typeof from === 'string' ? from : from.headers.get(DOYA_POWER_OP_HEADER)
    if (!key) return
    memory.remember(slot, key)
    setVersion((v) => v + 1)
  }, [enabled, slot])

  return { halved, retryOf, headers, remember }
}
