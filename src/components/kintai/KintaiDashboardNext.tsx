'use client'
// ============================================
// 勤怠のマイページ（チェックリスト S-46〜S-49・S-61）
// ============================================
// ⚠️ データの取得は page.tsx のまま。ここは受け取った値を出すだけ。
// ⚠️ 絵文字をアイコンに使わない（lucide）。主ボタンはブランドの青で1つ。
import Link from 'next/link'
import { CalendarDays, FilePlus2, History, ListChecks } from 'lucide-react'
import { Badge, Button, ErrorNotice, Skeleton, StatTile, ToolHero } from '@/components/ds'
import { CountUp, Stagger, StaggerItem } from '@/components/ds/motion'
import { MonthWorkInfo } from './KintaiInfographics'
import styles from './kintai-next.module.css'

export type KintaiClockStatus = 'not_clocked_in' | 'working' | 'on_break' | 'clocked_out'

// キービジュアル（仮）: 既存の熊のキャラクター。統括が public/ui-next/kintai/hero.webp を置いたら差し替える
const STATUS: Record<KintaiClockStatus, { label: string; tone: 'neutral' | 'blue' | 'ok' | 'note'; art: string }> = {
  not_clocked_in: { label: 'まだ出勤していません', tone: 'note', art: '/kintai/characters/hello_%E6%8C%A8%E6%8B%B6.png' },
  working: { label: '勤務中', tone: 'ok', art: '/kintai/characters/working_%E4%BD%9C%E6%A5%AD%E4%B8%AD.png' },
  on_break: { label: '休憩中', tone: 'note', art: '/kintai/characters/ramen_%E4%BC%91%E6%86%A9.png' },
  clocked_out: { label: '今日の勤務は終わりました', tone: 'blue', art: '/kintai/characters/jump_%E5%A4%A7%E5%96%9C%E3%81%B3.png' },
}

const hours = (minutes: number) => Math.max(0, minutes || 0) / 60
const fmtHours = (n: number) => (Math.round(n * 10) / 10).toFixed(1)

export function KintaiDashboardLoading() {
  return (
    <div className={styles.loading} aria-busy="true" aria-label="読み込み中">
      <Skeleton lines={2} height={28} delayMs={0} />
      <Skeleton lines={4} height={18} delayMs={0} />
    </div>
  )
}

export function KintaiDashboardError({ message }: { message: string }) {
  return (
    <div className={styles.page}>
      <ErrorNotice what="マイページを読み込めませんでした。" how={message} onRetry={() => window.location.reload()} retryLabel="再読み込み" />
    </div>
  )
}

export default function KintaiDashboardNext({ name, status, now, summary, isActive }: {
  name: string
  status: string
  now: Date
  summary: { totalWorkDays: number; totalWorkMinutes: number; totalOvertimeMinutes: number; totalLateCount: number }
  isActive: boolean | null
}) {
  const sc = STATUS[(status in STATUS ? status : 'not_clocked_in') as KintaiClockStatus]
  const timeStr = now.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false })
  const dateStr = now.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short' })
  const hour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })).getHours()
  const greeting = hour < 12 ? 'おはようございます' : 'お疲れさまです'
  const inactive = isActive === false

  const actions = inactive
    ? [
        { href: '/kintai/attendance', label: '勤怠の履歴', sub: '今月の出勤と退勤を見る', Icon: CalendarDays },
        { href: '/kintai/requests', label: '申請の履歴', sub: '出した申請の状況を見る', Icon: History },
      ]
    : [
        { href: '/kintai/requests/new', label: '申請する', sub: '休暇・残業・打刻の修正', Icon: FilePlus2 },
        { href: '/kintai/attendance', label: '勤怠一覧', sub: '今月の出勤と退勤を見る', Icon: CalendarDays },
        { href: '/kintai/requests', label: 'マイ申請', sub: '出した申請の状況を見る', Icon: ListChecks },
      ]

  return (
    <div className={styles.page}>
      <ToolHero
        art={sc.art}
        title={<span className={styles.heroTitle}>{greeting}、<span className={styles.name}>{name}さん</span></span>}
        lead={
          <span className={styles.heroMeta}>
            <span className={styles.date}>{dateStr}</span>
            <span className={styles.time} suppressHydrationWarning>{timeStr}</span>
            <Badge tone={sc.tone}>{sc.label}</Badge>
          </span>
        }
        action={inactive ? undefined : (
          <div className={styles.heroActions}>
            <Button href="/kintai/clock" icon="Clock">{status === 'not_clocked_in' ? '出勤する' : '打刻画面へ'}</Button>
          </div>
        )}
      />

      <section aria-labelledby="kintai-month">
        <h3 id="kintai-month" className={styles.sectionTitle}>今月のまとめ</h3>
        <Stagger className={styles.stats}>
          <StaggerItem index={0}><StatTile icon="CalendarDays" label="出勤日数" value={<CountUp value={summary.totalWorkDays} />} unit="日" /></StaggerItem>
          <StaggerItem index={1}><StatTile icon="Clock" label="総勤務時間" value={<CountUp value={hours(summary.totalWorkMinutes)} format={fmtHours} />} unit="時間" /></StaggerItem>
          <StaggerItem index={2}><StatTile icon="Timer" label="残業時間" value={<CountUp value={hours(summary.totalOvertimeMinutes)} format={fmtHours} />} unit="時間" /></StaggerItem>
          <StaggerItem index={3}><StatTile icon="CalendarClock" label="遅刻" value={<CountUp value={summary.totalLateCount} />} unit="回" muted={summary.totalLateCount === 0} /></StaggerItem>
        </Stagger>
      </section>

      <MonthWorkInfo summary={summary} now={now} />

      <section aria-labelledby="kintai-actions">
        <h3 id="kintai-actions" className={styles.sectionTitle}>よく使う操作</h3>
        <div className={styles.actions}>
          {actions.map(({ href, label, sub, Icon }) => (
            <Link key={href} href={href} className={styles.action}>
              <span className={styles.actionIcon}><Icon size={20} strokeWidth={1.75} aria-hidden /></span>
              <span className={styles.actionText}>
                <span className={styles.actionLabel}>{label}</span>
                <span className={styles.actionSub}>{sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

