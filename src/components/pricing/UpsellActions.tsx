'use client'
// ============================================
// ドヤパワーが足りない・少ない・尽きたときの行動（チームに上げる・追加で買う・相談する）
// ============================================
// 区分は /api/pricing/upsell（旗 NEW_PRICING_ROLLOUT の内側）。404 や失敗なら null を返し、呼ぶ側は今までの案内のままにする。
// 文言と行き先は src/lib/pricing-v2/upsell.ts の decideUpsell()。追加で買うは /api/pricing/power-pack（Stripe の画面へ）。
import { useEffect, useState } from 'react'
import { ArrowRight, Plus, Users, MessageCircle } from 'lucide-react'
import { confirmDialog } from '@/components/ds'
import { decideUpsell, type UpsellAction, type UpsellKind, type UpsellTrigger } from '@/lib/pricing-v2/upsell'
import styles from '@/components/doya-power/doya-power.module.css'

export type UpsellInfo = { kind: UpsellKind; isOwner: boolean; seats: number | null; canBuyPack: boolean; canCheckoutTeam: boolean; starter?: { amount: number; at: string } | null }

let cached: Promise<UpsellInfo | null> | null = null
/** 区分を1回だけ読む（同じ画面の中で使い回す）。旗が off・失敗なら null */
export function loadUpsellInfo(): Promise<UpsellInfo | null> {
  cached ??= fetch('/api/pricing/upsell', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d && (d.kind === 'free' || d.kind === 'team' || d.kind === 'legacy') ? d as UpsellInfo : null))
    .catch(() => null)
  return cached
}

export function useUpsellInfo(enabled: boolean): UpsellInfo | null {
  const [info, setInfo] = useState<UpsellInfo | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    void loadUpsellInfo().then((v) => { if (alive) setInfo(v) })
    return () => { alive = false }
  }, [enabled])
  return info
}

const ICON = { buy_pack: Plus, team: Users, contact: MessageCircle } as const

function iconFor(a: UpsellAction) {
  if (a.kind === 'buy_pack') return ICON.buy_pack
  if (a.kind === 'link' && a.href.startsWith('mailto:')) return ICON.contact
  return ICON.team
}

/** 知らせの中に置く行動の一覧（LowPowerNotice の actions に渡す） */
export function UpsellActions({ info, trigger, required, recoveryLabel }: { info: UpsellInfo; trigger: UpsellTrigger; required?: number; recoveryLabel?: string | null }) {
  const view = decideUpsell({ ...info, trigger, required, recoveryLabel })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (a: UpsellAction) => {
    if (busy) return
    if (a.kind === 'link') {
      if (a.confirm && !(await confirmDialog({ title: a.confirm.title, message: a.confirm.message, confirmLabel: a.confirm.confirmLabel }))) return
      window.location.href = a.href
      return
    }
    if (a.kind !== 'buy_pack') return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/pricing/power-pack', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packs: a.packs }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && typeof d.url === 'string' && d.url.startsWith('https://')) { window.location.href = d.url; return }
      setError(typeof d.error === 'string' ? d.error : '決済画面を開けませんでした。')
    } catch { setError('決済画面を開けたか確認できませんでした。重ねて買わずに、少し待ってからお試しください。') }
    setBusy(false)
  }

  const item = (a: UpsellAction, primary: boolean) => {
    const Icon = iconFor(a)
    const inner = (
      <>
        <span className={styles.choiceIcon}><Icon size={18} aria-hidden /></span>
        <span className={styles.choiceText}>
          <b className={styles.choiceTitle}>{a.kind === 'buy_pack' && busy ? '決済画面を準備しています…' : a.label}</b>
          {a.sub ? <span className={styles.choiceSub}>{a.sub}</span> : null}
        </span>
        {a.kind !== 'disabled' ? <ArrowRight size={16} aria-hidden className={styles.choiceGo} /> : null}
      </>
    )
    return (
      <li key={a.label}>
        {a.kind === 'disabled'
          ? <span className={styles.choice} aria-disabled="true" data-primary={primary ? 'true' : undefined}>{inner}</span>
          : <button type="button" className={styles.choice} onClick={() => run(a)} disabled={busy} data-primary={primary ? 'true' : undefined}>{inner}</button>}
      </li>
    )
  }

  return (
    <div data-upsell-kind={info.kind}>
      <p className={styles.noticeBody}>{view.body}</p>
      <ul className={styles.choices} aria-label="ドヤパワーを増やす方法">
        {item(view.primary, true)}
        {view.secondary.map((a) => item(a, false))}
      </ul>
      {error ? <p className={styles.noticeBody} role="alert">{error}</p> : null}
    </div>
  )
}
