'use client'
// ============================================
// ドヤパワー — 組織ごとのポイントの表示の部品
// ============================================
// - DoyaPowerGauge      … 残りのゲージ（数字つき。色だけで伝えない）
// - PowerEquivalents    … 残りの言い換え（あと バナー30枚／記事110本）
// - LowPowerNotice      … 残りが少ないときの、やさしい知らせ
// - MorningRecoveryToast… 朝の回復の知らせ（画面の中だけ。日本時間で1日1回）
// - CostBadge           … ボタンに減る量を付ける札（src/components/ds/cost-badge.tsx）
// ⚠️ 値はすべて props で受け取る。残りの計算（台帳）は別のところ（ui-next/doyapower-ledger）が持つ。ここで取りに行かない。
// ⚠️ 新しい見た目（isUiNext() / useUiNext()）の中でだけ使う。
// ⚠️ 演出の設定（組織・個人）でドヤくんと動きを切れる。どちらかがオフならオフ。prefers-reduced-motion でも動かさない。
// ⚠️ メール・通知は送らない。知らせは画面の中だけ。
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowRight, BatteryLow, Sunrise, X } from 'lucide-react'
import { ShellIcon, type ShellIconName } from '@/components/shell/icons'
import { CountUp, useInViewOnce, usePrefersReducedMotion } from '@/components/ds/motion'
import { jstDateKey, jstDateTime, recoveryLabel } from './time'
import styles from './doya-power.module.css'

export { CostBadge } from '@/components/ds/cost-badge'

/* ---- 表示の設定（演出） ---- */

/** 組織と個人の、表示の設定。省略したものは「オン」 */
export type DoyaPowerFxSetting = { mascot?: boolean; effects?: boolean }
export type DoyaPowerFx = { org?: DoyaPowerFxSetting; user?: DoyaPowerFxSetting }
export type ResolvedFx = { mascot: boolean; effects: boolean }

/** 組織と個人の設定を合わせる。どちらかがオフならオフ（組織がオフにしたものは、個人で戻せない） */
export function resolveDoyaPowerFx(fx?: DoyaPowerFx): ResolvedFx {
  return {
    mascot: fx?.org?.mascot !== false && fx?.user?.mascot !== false,
    effects: fx?.org?.effects !== false && fx?.user?.effects !== false,
  }
}

/** 実際に動かしてよいか（設定がオン かつ 動きを減らす設定ではない） */
function useMotionOn(fx: ResolvedFx): boolean {
  const reduced = usePrefersReducedMotion()
  return fx.effects && !reduced
}

/* ---- 換算の表 ---- */

/** 1回あたりの量（例: { id: 'banner', label: 'バナー', unit: '枚', cost: 10, icon: 'Image' }） */
export type PowerConversion = {
  id: string
  label: string
  /** 数え方（枚・本・件・回） */
  unit: string
  /** 1つ作るのに減る量 */
  cost: number
  icon?: ShellIconName
}

/** 残りで、それぞれあと何回できるか */
export function powerEquivalents(remaining: number, table: PowerConversion[]): (PowerConversion & { count: number })[] {
  const r = Math.max(0, Math.floor(remaining))
  return table
    .filter((c) => c.cost > 0)
    .map((c) => ({ ...c, count: Math.floor(r / c.cost) }))
}

const fmt = (n: number) => Math.max(0, Math.round(n)).toLocaleString('ja-JP')

/* ---- ドヤくん（絵は public/character/<ポーズ>-256.webp。大きさは先に決めて CLS を出さない） ---- */
type MascotPose = 'thumbsup' | 'thinking' | 'hello' | 'point' | 'success'
function Mascot({ pose, size, className }: { pose: MascotPose; size: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/character/${pose}-256.webp`} alt="" width={size} height={size} className={`${styles.mascot} ${className ?? ''}`} loading="lazy" decoding="async" />
  )
}

/* ---- DoyaPowerGauge ---- */

export function DoyaPowerGauge({
  remaining,
  limit,
  label = 'ドヤパワー',
  unitLabel = 'pt',
  conversions,
  nextRecoveryAt,
  now,
  lowRatio = 0.2,
  fx,
  className,
}: {
  /** 残り */
  remaining: number
  /** 上限（回復したときの量） */
  limit: number
  label?: string
  /** 数字のあとの単位（既定 pt） */
  unitLabel?: string
  /** 換算の表。渡すと「できること」に言い換えて下に出す */
  conversions?: PowerConversion[]
  /** 次に回復する時刻 */
  nextRecoveryAt?: Date | string | number
  /** 今の時刻。渡すと「明日 6:00」の言い方になる（渡さないと日付つき） */
  now?: Date | string | number
  /** この割合より下で「残りわずか」を出す（0〜1） */
  lowRatio?: number
  fx?: DoyaPowerFx
  className?: string
}) {
  const f = resolveDoyaPowerFx(fx)
  const motion = useMotionOn(f)
  const { ref, seen } = useInViewOnce<HTMLDivElement>()
  const max = Math.max(0, limit)
  const value = Math.min(Math.max(0, remaining), max)
  const ratio = max > 0 ? value / max : 0
  const low = ratio < lowRatio
  // 動かすときは、画面に入ってから伸ばす。動かさないときは最初から最後の形
  const fill = motion && !seen ? 0 : ratio
  const pct = Math.round(ratio * 100)
  const recovery = nextRecoveryAt !== undefined ? recoveryLabel(nextRecoveryAt, now) : null

  return (
    <section className={`${styles.gauge} ${className ?? ''}`} data-low={low ? 'true' : undefined} data-motion={motion ? 'on' : 'off'} aria-label={`${label}の残り`}>
      <div className={styles.gaugeHead}>
        <p className={styles.gaugeLabel}>
          <span className={styles.gaugeIcon}><ShellIcon name="Sparkles" size={16} aria-hidden /></span>
          {label}
          {low ? <span className={styles.lowTag}>残りわずか</span> : null}
        </p>
        <p className={styles.gaugeNums}>
          <span className={styles.gaugeSmall}>残り</span>
          <span className={styles.gaugeValue}>
            {motion ? <CountUp value={value} duration={1100} /> : fmt(value)}
          </span>
          <span className={styles.gaugeSmall}>/ 上限 {fmt(max)}{unitLabel ? ` ${unitLabel}` : ''}</span>
        </p>
      </div>

      <div className={styles.gaugeBody}>
        <div
          ref={ref}
          className={styles.track}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`残り ${fmt(value)} / 上限 ${fmt(max)}（${pct}%）`}
          aria-label={label}
        >
          <span className={styles.fill} style={{ '--fill': fill } as CSSProperties}>
            {motion ? <span className={styles.shine} aria-hidden /> : null}
          </span>
          {/* 目盛り（25・50・75%）。インフォグラフィックの目安 */}
          {[25, 50, 75].map((t) => <span key={t} className={styles.tick} style={{ left: `${t}%` }} aria-hidden />)}
        </div>
        {f.mascot ? <Mascot pose={low ? 'thinking' : 'thumbsup'} size={48} className={styles.gaugeMascot} /> : null}
      </div>

      <div className={styles.gaugeFoot}>
        <span className={styles.pct}>{pct}%</span>
        {recovery ? <span className={styles.recovery}><Sunrise size={14} aria-hidden />{recovery} に {fmt(max)} まで回復</span> : null}
      </div>

      {conversions && conversions.length ? <PowerEquivalents remaining={value} conversions={conversions} /> : null}
    </section>
  )
}

/* ---- PowerEquivalents（残りの言い換え） ---- */

export function PowerEquivalents({ remaining, conversions, limit = 3, lead = 'あと', className }: {
  remaining: number
  conversions: PowerConversion[]
  /** 出す数（多いと読めないので既定3つ） */
  limit?: number
  lead?: ReactNode
  className?: string
}) {
  const items = powerEquivalents(remaining, conversions).slice(0, limit)
  if (!items.length) return null
  return (
    <div className={`${styles.equiv} ${className ?? ''}`}>
      <span className={styles.equivLead}>{lead}</span>
      <ul className={styles.equivList}>
        {items.map((c) => (
          <li key={c.id} className={styles.equivItem}>
            {c.icon ? <ShellIcon name={c.icon} size={15} aria-hidden /> : null}
            <span>{c.label}</span>
            <span className={styles.equivCount}>{fmt(c.count)}</span>
            <span>{c.unit}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---- LowPowerNotice（残りが少ないとき） ---- */

export function LowPowerNotice({
  remaining,
  limit,
  nextRecoveryAt,
  now,
  conversions,
  moreHref,
  moreLabel = 'ドヤパワーを増やす方法',
  label = 'ドヤパワー',
  fx,
  onClose,
  className,
}: {
  remaining: number
  limit: number
  nextRecoveryAt?: Date | string | number
  now?: Date | string | number
  /** 渡すと「あと バナー2枚分」のように言い換える（いちばん軽いもの1つ） */
  conversions?: PowerConversion[]
  /** 増やし方への案内の行き先 */
  moreHref?: string
  moreLabel?: string
  label?: string
  fx?: DoyaPowerFx
  onClose?: () => void
  className?: string
}) {
  const f = resolveDoyaPowerFx(fx)
  const motion = useMotionOn(f)
  const value = Math.max(0, remaining)
  const recovery = nextRecoveryAt !== undefined ? recoveryLabel(nextRecoveryAt, now) : null
  const lightest = conversions ? powerEquivalents(value, conversions).sort((a, b) => a.cost - b.cost)[0] : undefined
  const title = value <= 0 ? `今日の${label}を使い切りました` : `${label}が残り少なくなっています`
  return (
    <section className={`${styles.notice} ${className ?? ''}`} role="status" data-motion={motion ? 'on' : 'off'}>
      {f.mascot ? <Mascot pose="thinking" size={56} className={styles.noticeMascot} /> : <span className={styles.noticeIcon}><BatteryLow size={20} aria-hidden /></span>}
      <div className={styles.noticeText}>
        <p className={styles.noticeTitle}>{title}</p>
        <p className={styles.noticeBody}>
          {value > 0 ? <>残りは <b className={styles.noticeNum}>{fmt(value)}</b> / {fmt(limit)} です{lightest && lightest.count > 0 ? `（あと ${lightest.label}${fmt(lightest.count)}${lightest.unit}分）` : ''}。</> : <>たくさん使っていただき、ありがとうございます。</>}
          {recovery ? <>{recovery} に {fmt(limit)} まで回復します。</> : null}
          {value > 0 ? 'いま作っているものは、そのまま続けられます。' : '回復するまで、作ったものの確認や編集はそのままできます。'}
        </p>
        {moreHref ? (
          <a href={moreHref} className={styles.noticeLink}>{moreLabel}<ArrowRight size={14} aria-hidden /></a>
        ) : null}
      </div>
      {onClose ? <button type="button" className={styles.close} onClick={onClose} aria-label="知らせを閉じる"><X size={16} aria-hidden /></button> : null}
    </section>
  )
}

/* ---- MorningRecoveryToast（朝の回復。画面の中だけで1日1回） ---- */

const TOAST_KEY = 'doya_power_morning:'
// localStorage が使えない環境では、開いている間だけ覚える（同じ日に何度も出さない）
const shownInMemory = new Set<string>()

/** 今日（日本時間）に出してよいか。recoveredAt が今日でなければ出さない */
export function shouldShowMorningToast(input: { now: Date | string | number; recoveredAt: Date | string | number; lastShownDay: string | null }): boolean {
  const today = jstDateKey(input.now)
  return !!today && jstDateKey(input.recoveredAt) === today && input.lastShownDay !== today
}

export function MorningRecoveryToast({
  recoveredAt,
  amount,
  limit,
  scope = 'default',
  label = 'ドヤパワー',
  conversions,
  fx,
  placement = 'fixed',
  ignoreStorage = false,
  autoHideMs = 8000,
}: {
  /** 回復した時刻（今朝の回復）。日本時間で今日のときだけ出す */
  recoveredAt: Date | string | number
  /** 回復した量（上限まで戻ったなら limit と同じ） */
  amount?: number
  limit: number
  /** 覚えるときの名前（組織の id など）。組織ごとに1日1回 */
  scope?: string
  label?: string
  conversions?: PowerConversion[]
  fx?: DoyaPowerFx
  /** fixed … 画面の右下に重ねる（ふつう）。inline … その場に置く（見本用） */
  placement?: 'fixed' | 'inline'
  /** 見本用。覚えた日を見ずに必ず出す（覚えもしない） */
  ignoreStorage?: boolean
  /** この時間が過ぎたら閉じる（0 で閉じない）。動きを切っているときも閉じる */
  autoHideMs?: number
}) {
  const f = resolveDoyaPowerFx(fx)
  const motion = useMotionOn(f)
  const [open, setOpen] = useState(false)
  const key = `${TOAST_KEY}${scope}`

  // 出すかどうかは、画面に出てから決める（サーバーでは出さない。日付は日本時間）
  useEffect(() => {
    const now = Date.now()
    if (ignoreStorage) { setOpen(true); return }
    let last: string | null = shownInMemory.has(key) ? jstDateKey(now) : null
    try { last = window.localStorage.getItem(key) ?? last } catch { /* 使えなくても続ける */ }
    if (!shouldShowMorningToast({ now, recoveredAt, lastShownDay: last })) return
    setOpen(true)
    const today = jstDateKey(now)
    shownInMemory.add(key)
    try { window.localStorage.setItem(key, today) } catch { /* 覚えられなくても出す */ }
  }, [key, recoveredAt, ignoreStorage])

  useEffect(() => {
    if (!open || !autoHideMs) return
    const t = setTimeout(() => setOpen(false), autoHideMs)
    return () => clearTimeout(t)
  }, [open, autoHideMs])

  if (!open) return null
  const top = conversions ? powerEquivalents(limit, conversions).slice(0, 2) : []
  return (
    <div className={styles.toast} data-placement={placement} data-motion={motion ? 'on' : 'off'} role="status" aria-live="polite">
      {f.mascot ? <Mascot pose="hello" size={52} className={styles.toastMascot} /> : <span className={styles.toastIcon}><Sunrise size={20} aria-hidden /></span>}
      <div className={styles.toastText}>
        <p className={styles.toastTitle}>おはようございます。{label}が回復しました</p>
        <p className={styles.toastBody}>
          {amount !== undefined && amount < limit ? `${fmt(amount)} 回復して、` : ''}
          今日は {fmt(limit)} 使えます
          {top.length ? `（${top.map((c) => `${c.label}${fmt(c.count)}${c.unit}`).join('／')}）` : ''}。
        </p>
        <p className={styles.toastTime}>{jstDateTime(recoveredAt)} に回復</p>
      </div>
      <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="知らせを閉じる"><X size={16} aria-hidden /></button>
    </div>
  )
}
