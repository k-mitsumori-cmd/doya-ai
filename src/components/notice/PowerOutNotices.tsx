'use client'
// ============================================
// ドヤパワーが足りない・少ない・0のときの知らせと、「100からスタート」のようこそ（知らせのシートで出す）
// ============================================
// 分担（2026-10-26）: 何を出すか（文・行き先）は新料金の powerOutView()・STARTER_WELCOME。ここは出し方だけ。
// - 足りない（402。DOYA_POWER_INSUFFICIENT_EVENT）… 毎回出す。エラーと同じ扱い（作業中でも出し、知らせの量が「エラーだけ」でも出す）
// - 0（empty）… 1日1回。エラーと同じ扱い
// - 2割未満（low）… 月1回。ヒント
// - 回数の記録は、新料金の upsellFrequencyKey() をそのまま「見た」の id に使う
// ⚠️ 新料金の旗が off（/api/pricing/upsell が 404）なら、ここは何も出さない。今の ShellLowPowerNotice がそのまま出す
// ⚠️ NoticeProvider の中だけで動く（旗 GUIDE_POPUPS_ROLLOUT が off なら、この部品は置かれない）
import { useContext, useEffect } from 'react'
import { useDoyaPower } from '@/components/doya-power/doya-power-context'
import { DOYA_POWER_INSUFFICIENT_EVENT, type DoyaPowerInsufficient } from '@/components/doya-power/insufficient'
import { useUpsellInfo, type UpsellInfo } from '@/components/pricing/UpsellActions'
import { ShellPowerContext } from '@/components/shell/power'
import { powerOutView, type PowerOutView } from '@/lib/pricing-v2/power-out'
import { isLowPower, upsellFrequencyKey } from '@/lib/pricing-v2/upsell'
// starter-welcome.ts は node: を使わないので、画面から読める（新料金の 3404707b で starter.ts から移った）
import { STARTER_WELCOME } from '@/lib/pricing-v2/starter-welcome'
import type { Notice, NoticeAction } from '@/lib/notice/queue'
import { useNotice } from './NoticeProvider'

/** powerOutView の答えを、知らせのシートの形にする（ボタンは最大3つ。1つ目が主） */
export function noticeFromPowerOut(view: PowerOutView, id: string, once: boolean): Notice {
  const [a, b, c] = view.actions.map((x): NoticeAction => ({ label: x.label, href: x.href }))
  return {
    id, once,
    kind: view.trigger === 'low' ? 'hint' : 'error',
    tone: 'warn', pose: 'focus', eyebrow: 'ドヤパワー', title: view.title, body: view.body || undefined,
    primary: a ?? { label: 'わかった' },
    secondary: b ? { ...b } : { label: 'あとで', done: false },
    tertiary: c,
  }
}

/** 旗の内側で、ドヤパワーの知らせを知らせのシートへ寄せる。upsell が読めたとき（新料金の旗が on）だけ動く */
export default function PowerOutNotices() {
  const { enabled: on, ready, push } = useNotice()
  const doyaPower = useDoyaPower()
  const info: UpsellInfo | null = useUpsellInfo(on && doyaPower)
  const power = useContext(ShellPowerContext)
  const enabled = on && ready && doyaPower && Boolean(info)

  // 足りない（402）: 毎回
  useEffect(() => {
    if (!enabled || !info) return
    const onInsufficient = (e: Event) => {
      const d = (e as CustomEvent<DoyaPowerInsufficient>).detail
      const view = powerOutView({ ...info, remaining: d.balance, limit: d.limit, required: d.required, nextRecoveryAt: d.nextRecoveryAt })
      if (view) push(noticeFromPowerOut(view, `power-insufficient:${Date.now()}`, false))
    }
    window.addEventListener(DOYA_POWER_INSUFFICIENT_EVENT, onInsufficient)
    return () => window.removeEventListener(DOYA_POWER_INSUFFICIENT_EVENT, onInsufficient)
  }, [enabled, info, push])

  // 0（1日1回）・2割未満（月1回）
  const remaining = power.balance?.remaining
  const limit = power.balance?.limit
  useEffect(() => {
    if (!enabled || !info || remaining == null || !limit) return
    const trigger = remaining <= 0 ? 'empty' : isLowPower(remaining, limit) ? 'low' : null
    if (!trigger) return
    const view = powerOutView({ ...info, remaining, limit })
    if (view) push(noticeFromPowerOut(view, upsellFrequencyKey(trigger, new Date()), true))
  }, [enabled, info, remaining, limit, push])

  // 100からスタートのようこそ（最初の100を受け取った人に1回だけ）
  useEffect(() => {
    if (!enabled || !info?.starter) return
    push({ id: 'starter-welcome:v1', kind: 'hint', once: true, pose: 'jump', eyebrow: 'ドヤパワー', title: STARTER_WELCOME.title, body: STARTER_WELCOME.body,
      primary: { label: STARTER_WELCOME.action.label, href: STARTER_WELCOME.action.href } })
  }, [enabled, info, push])

  return null
}

/** 知らせの側が、ドヤパワーの知らせを受け持っているか（ShellLowPowerNotice が黙るかどうかに使う） */
export function powerOutHandledByNotice(info: UpsellInfo | null, guide: boolean): boolean {
  return guide && Boolean(info)
}
