'use client'
// ドヤくんの表示と演出の設定を、画面の部品に伝える。
// 画面（ページ）が読んだ設定を <DoyaPowerFxProvider fx={...}> で渡すと、中のゲージ・図鑑・ミッション・年間レポートが見る。
// 設定の部品（DoyaPowerFxSettings）で変えると、同じ画面の中がすぐ切り替わる。
// 渡さなければ、すべてオン（ただし prefers-reduced-motion では動かさない）。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { resolveDoyaPowerFx, type DoyaPowerFx, type DoyaPowerFxSetting, type FxScope, type ResolvedFx } from '@/lib/doya-power/fx'
import { usePrefersReducedMotion } from '@/components/ds/motion'

type FxValue = { fx: DoyaPowerFx | undefined; update: ((scope: FxScope, setting: DoyaPowerFxSetting) => void) | null }
const FxContext = createContext<FxValue>({ fx: undefined, update: null })

export function DoyaPowerFxProvider({ fx, children }: { fx?: DoyaPowerFx; children: ReactNode }) {
  const [state, setState] = useState<DoyaPowerFx | undefined>(fx)
  // サーバーから新しい設定が渡されたとき（router.refresh のあと）は、それに合わせる
  const sig = JSON.stringify(fx ?? null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setState(fx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])
  const update = useCallback((scope: FxScope, setting: DoyaPowerFxSetting) => {
    setState((cur) => ({ ...(cur ?? {}), [scope]: { ...(cur?.[scope] ?? {}), ...setting } }))
  }, [])
  const value = useMemo(() => ({ fx: state, update }), [state, update])
  return <FxContext.Provider value={value}>{children}</FxContext.Provider>
}

/** 画面が持っている設定と、変える関数（Provider の外では null） */
export function useDoyaPowerFxState(): FxValue {
  return useContext(FxContext)
}

/** 設定を合わせた結果。explicit を渡すと、そちらを優先する（部品の props の fx）。motion は「設定がオン かつ 動きを減らす設定ではない」 */
export function useDoyaPowerFx(explicit?: DoyaPowerFx): ResolvedFx & { motion: boolean } {
  const ctx = useContext(FxContext)
  const reduced = usePrefersReducedMotion()
  const f = resolveDoyaPowerFx(explicit ?? ctx.fx)
  return { ...f, motion: f.effects && !reduced }
}
