'use client'
// ============================================
// 「ドヤパワーが足りない」の知らせ（共通の枠）
// ============================================
// 生成の API が 402（DOYA_POWER_INSUFFICIENT）を返したとき、画面の右下にやさしい知らせを出す。
// - DoyaPowerFetchWatcher: 同じサイトの /api/ の応答を1か所で見る（各ツールの fetch は書き換えない）
// - ShellLowPowerNotice: 知らせ（LowPowerNotice）。残りの数字・次の回復の時刻・増やし方への案内
// ⚠️ 旗（DOYA_POWER_ROLLOUT）が出すと決めた人のときだけ動く（useDoyaPower()）。off のときは fetch にも触れない
// ⚠️ 知らせは、ツールごとのエラーの表示とは別に出す。ツールの表示はそのまま
import { useContext, useEffect, useState } from 'react'
import { LowPowerNotice } from '@/components/doya-power'
import { useDoyaPower } from '@/components/doya-power/doya-power-context'
import {
  DOYA_POWER_INSUFFICIENT_EVENT,
  isOwnApiRequest,
  notifyIfDoyaPowerInsufficient,
  type DoyaPowerInsufficient,
} from '@/components/doya-power/insufficient'
import { ShellPowerContext } from './power'
import { UpsellActions, useUpsellInfo } from '@/components/pricing/UpsellActions'
import { isLowPower, upsellFrequencyKey } from '@/lib/pricing-v2/upsell'
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

/** 次の回復の時刻の言い方（日本時間。例: 「10月27日 0:00」） */
function recoveryText(at: string | undefined): string | null {
  if (!at) return null
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function seen(key: string): boolean {
  try { return window.localStorage.getItem(key) === '1' } catch { return false }
}
function markSeen(key: string) {
  try { window.localStorage.setItem(key, '1') } catch { /* 覚えられなくても出すだけ */ }
}

/**
 * 知らせ。新しい「足りない」が来るたびに出し直し、閉じたら消える。
 * 新しい料金の旗（NEW_PRICING_ROLLOUT）が on の人には、区分（フリー・チーム・据え置き）に合わせた行動を出す（UpsellActions）。
 * さらに、残りが2割を切ったとき（月1回）と、0になったとき（1日1回）にも、やさしく出す。
 * ⚠️ 旗が off（/api/pricing/upsell が 404）なら、今までどおり「足りない」ときだけ、今までの案内で出す。
 */
export function ShellLowPowerNotice({ handledByNotice = false }: {
  /** ドヤくんの知らせ（旗 GUIDE_POPUPS_ROLLOUT）が出ていて、新料金の upsell も読めたときは、知らせのシート（PowerOutNotices）が受け持つ */
  handledByNotice?: boolean
} = {}) {
  const enabled = useDoyaPower()
  const info = useUpsellInfo(enabled)
  const takeover = handledByNotice && Boolean(info)
  const power = useContext(ShellPowerContext)
  const [detail, setDetail] = useState<DoyaPowerInsufficient | null>(null)
  const [nudge, setNudge] = useState<'low' | 'empty' | null>(null)
  useEffect(() => {
    if (!enabled || takeover) return
    const on = (e: Event) => { setNudge(null); setDetail((e as CustomEvent<DoyaPowerInsufficient>).detail) }
    window.addEventListener(DOYA_POWER_INSUFFICIENT_EVENT, on)
    return () => window.removeEventListener(DOYA_POWER_INSUFFICIENT_EVENT, on)
  }, [enabled, takeover])
  // 残りが少ない・0 のやさしい知らせ（新しい料金のときだけ。足りない知らせが出ていれば出さない）
  const balance = power.balance
  useEffect(() => {
    if (!enabled || !info || !balance || detail || takeover) return
    const now = new Date()
    const trigger = balance.remaining <= 0 ? 'empty' : isLowPower(balance.remaining, balance.limit) ? 'low' : null
    if (!trigger) return
    const key = upsellFrequencyKey(trigger, now)
    if (seen(key)) return
    markSeen(key)
    setNudge(trigger)
  }, [enabled, info, balance, detail, takeover])
  if (!enabled || takeover) return null
  if (detail) {
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
          actions={info ? <UpsellActions info={info} trigger="insufficient" required={detail.required} recoveryLabel={recoveryText(detail.nextRecoveryAt)} /> : undefined}
          onClose={() => setDetail(null)}
        />
      </div>
    )
  }
  if (nudge && info && balance) {
    return (
      <div className={styles.lowPower} role="region" aria-label="ドヤパワーの知らせ">
        <LowPowerNotice
          remaining={balance.remaining}
          limit={balance.limit}
          actions={<UpsellActions info={info} trigger={nudge} />}
          onClose={() => setNudge(null)}
        />
      </div>
    )
  }
  return null
}
