'use client'
// ============================================
// 「ドヤパワーが足りない」の知らせ（共通の枠）
// ============================================
// 生成の API が 402（DOYA_POWER_INSUFFICIENT）を返したとき、画面の右下にやさしい知らせを出す。
// - DoyaPowerFetchWatcher: 同じサイトの /api/ の応答を1か所で見る（各ツールの fetch は書き換えない）
// - ShellLowPowerNotice: 知らせ（LowPowerNotice）。残りの数字・次の回復の時刻・増やし方への案内
// ⚠️ 旗（DOYA_POWER_ROLLOUT）が出すと決めた人のときだけ動く（useDoyaPower()）。off のときは fetch にも触れない
// ⚠️ 知らせは、ツールごとのエラーの表示とは別に出す。ツールの表示はそのまま
import { useEffect, useState } from 'react'
import { LowPowerNotice } from '@/components/doya-power'
import { useDoyaPower } from '@/components/doya-power/doya-power-context'
import {
  DOYA_POWER_INSUFFICIENT_EVENT,
  isOwnApiRequest,
  notifyIfDoyaPowerInsufficient,
  type DoyaPowerInsufficient,
} from '@/components/doya-power/insufficient'
import styles from './power.module.css'

/** 同じサイトの /api/ の応答を見て、402 の「足りない」を知らせに回す */
export function DoyaPowerFetchWatcher() {
  const enabled = useDoyaPower()
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const original = window.fetch
    const watched: typeof window.fetch = async (input, init) => {
      const res = await original(input, init)
      if (res.status === 402 && isOwnApiRequest(input, window.location.origin)) void notifyIfDoyaPowerInsufficient(res)
      return res
    }
    window.fetch = watched
    return () => {
      // ほかの部品があとから包み直していなければ、元に戻す
      if (window.fetch === watched) window.fetch = original
    }
  }, [enabled])
  return null
}

/** 知らせ。新しい「足りない」が来るたびに出し直し、閉じたら消える */
export function ShellLowPowerNotice() {
  const enabled = useDoyaPower()
  const [detail, setDetail] = useState<DoyaPowerInsufficient | null>(null)
  useEffect(() => {
    if (!enabled) return
    const on = (e: Event) => setDetail((e as CustomEvent<DoyaPowerInsufficient>).detail)
    window.addEventListener(DOYA_POWER_INSUFFICIENT_EVENT, on)
    return () => window.removeEventListener(DOYA_POWER_INSUFFICIENT_EVENT, on)
  }, [enabled])
  if (!enabled || !detail) return null
  return (
    <div className={styles.lowPower} role="region" aria-label="ドヤパワーの知らせ">
      <LowPowerNotice
        remaining={detail.balance}
        limit={detail.limit}
        nextRecoveryAt={detail.nextRecoveryAt}
        recoveryAmount={detail.recoveryAmount}
        title={`この操作には、ドヤパワーが ${detail.required.toLocaleString('ja-JP')} 要ります`}
        blockedText="回復するまで、作ったものの確認や編集はそのままできます。"
        moreHref="/pricing"
        moreLabel="プランを見る"
        onClose={() => setDetail(null)}
      />
    </div>
  )
}
