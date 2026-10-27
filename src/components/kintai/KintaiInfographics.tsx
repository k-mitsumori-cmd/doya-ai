'use client'
// ============================================
// 勤怠のインフォグラフィック（2026-10-27 ユーザー「勤怠もインフォグラフィックのアニメーションで分かりやすく」）
// ============================================
// - MonthWorkInfo: マイページの「今月の勤務」。出勤した日の割合の円・通常と残業の割合の帯・残業の上限の目安
// - TeamTodayInfo: 部署勤怠の「今日の出勤の状況」。人の形を状態ごとの色で並べ、出勤の割合の円を出す
// - DailyWorkChart: 勤怠一覧の「日ごとの勤務時間」。通常と残業を積み上げた縦棒
// ⚠️ 取得はしない。各画面が持っている値を受け取って並べるだけ
// ⚠️ 色はトークン。色だけで伝えず、凡例と数を出す。動きを減らす設定では動かさない（ds の部品が対応）
import { Bars, Ring, StackedBar100, StackedColumnChart } from '@/components/ds/charts'
import { BigFigure, InfoEmpty, InfoPanel, InfoReserve, Pictogram } from '@/components/ds/infographic'

/** 出勤の状況の枠の高さ（px。読み込み中の枠と同じ。1280px と 375px の実測） */
export const TEAM_TODAY_H = 132
export const TEAM_TODAY_H_SM = 312
import { CountUp } from '@/components/ds/motion'
import { businessDaysOf } from '@/lib/kintai/jp-holidays'

const h1 = (min: number) => Math.round((Math.max(0, min || 0) / 60) * 10) / 10
const fmtH = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)}時間`

/** 残業の上限の目安（月45時間。36協定の原則の上限） */
const OVERTIME_LIMIT_MIN = 45 * 60

export function MonthWorkInfo({ summary, now }: {
  summary: { totalWorkDays: number; totalWorkMinutes: number; totalOvertimeMinutes: number; totalLateCount: number }
  now: Date
}) {
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  // 今日までの平日（土日と祝日を除く。会社ごとの休みは含まない）
  const businessDays = businessDaysOf(jst.getFullYear(), jst.getMonth() + 1, jst.getDate())
  const rate = businessDays > 0 ? Math.min(1, summary.totalWorkDays / businessDays) : 0
  const overtime = Math.max(0, summary.totalOvertimeMinutes || 0)
  const regular = Math.max(0, (summary.totalWorkMinutes || 0) - overtime)
  const otRate = overtime / OVERTIME_LIMIT_MIN
  return (
    <InfoPanel title="今月の勤務" meta={`${jst.getMonth() + 1}月1日から今日まで`}>
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center gap-5">
          <Ring value={rate} size={128} label={`今日までの平日（祝日を除く）${businessDays} 日のうち ${summary.totalWorkDays} 日出勤`} showToneLabel={false}>
            <span style={{ display: 'grid', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontSize: 28 }}><CountUp value={summary.totalWorkDays} /><small style={{ fontSize: 13 }}>日</small></span>
              <small style={{ fontSize: 11, fontWeight: 700, color: 'var(--sub)' }}>平日 {businessDays} 日中</small>
            </span>
          </Ring>
          <BigFigure value={h1(summary.totalWorkMinutes)} unit="時間" label="今月の総勤務" format={(n) => (Math.round(n * 10) / 10).toFixed(1)} />
        </div>
        <div className="grid gap-5">
          <StackedBar100
            label="今月の勤務のうち、通常と残業の割合"
            format={fmtH}
            rows={[{ label: '勤務の内訳', values: [h1(regular), h1(overtime)] }]}
            categories={[{ name: '通常', tone: 'blue' }, { name: '残業', tone: 'sky' }]}
          />
          <Bars
            format={(n) => fmtH(n)}
            data={[{
              label: '残業（上限の目安 45時間）',
              value: h1(overtime),
              sub: otRate >= 1 ? '上限を超えています' : otRate >= 0.8 ? '上限に近づいています' : `残り ${fmtH(h1(Math.max(0, OVERTIME_LIMIT_MIN - overtime)))}`,
              tone: otRate >= 0.8 ? 'poor' : 'sky',
            }, {
              label: '上限の目安',
              value: 45,
              tone: 'muted',
            }]}
          />
        </div>
      </div>
    </InfoPanel>
  )
}

export function TeamTodayInfo({ stats, dateLabel }: {
  stats: { working: number; clockedOut: number; notClocked: number; nonWorking: number }
  dateLabel: string
}) {
  const total = stats.working + stats.clockedOut + stats.notClocked + stats.nonWorking
  if (total === 0) {
    return (
      <InfoPanel title="出勤の状況" meta={dateLabel}>
        <InfoReserve height={TEAM_TODAY_H} mobileHeight={TEAM_TODAY_H_SM}><InfoEmpty>この日に出勤する予定の人はいません。</InfoEmpty></InfoReserve>
      </InfoPanel>
    )
  }
  const came = stats.working + stats.clockedOut
  const expected = total - stats.nonWorking
  const rate = expected > 0 ? came / expected : 0
  return (
    <InfoPanel title="出勤の状況" meta={dateLabel}>
      <InfoReserve height={TEAM_TODAY_H} mobileHeight={TEAM_TODAY_H_SM}>
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <Ring value={rate} size={132} label={`出勤する予定の ${expected} 名のうち ${came} 名が出勤`} showToneLabel={false}>
          <span style={{ display: 'grid', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ fontSize: 28 }}><CountUp value={came} /><small style={{ fontSize: 13 }}>/{expected}名</small></span>
            <small style={{ fontSize: 11, fontWeight: 700, color: 'var(--sub)' }}>出勤済み</small>
          </span>
        </Ring>
        <Pictogram
          label="今日の出勤の状況（人の形を状態ごとの色で並べたもの）"
          groups={[
            { label: '出勤中', count: stats.working, tone: 'blue' },
            { label: '退勤済', count: stats.clockedOut, tone: 'sky' },
            { label: '未出勤', count: stats.notClocked, tone: 'pink' },
            { label: '休暇・欠勤等', count: stats.nonWorking, tone: 'muted' },
          ]}
        />
      </div>
      </InfoReserve>
    </InfoPanel>
  )
}

export function DailyWorkChart({ data, year, month }: {
  data: { date: string; workMinutes?: number | null; overtimeMinutes?: number | null }[]
  year: number
  month: number
}) {
  const days = new Date(year, month, 0).getDate()
  const byDay = new Map<number, { work: number; ot: number }>()
  data.forEach((a) => {
    const d = Number(new Date(a.date).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(8, 10))
    const prev = byDay.get(d) ?? { work: 0, ot: 0 }
    byDay.set(d, { work: prev.work + (a.workMinutes || 0), ot: prev.ot + (a.overtimeMinutes || 0) })
  })
  if (byDay.size === 0) return null
  const labels = Array.from({ length: days }, (_, i) => `${i + 1}`)
  const regular = labels.map((_, i) => { const v = byDay.get(i + 1); return v ? h1(Math.max(0, v.work - v.ot)) : 0 })
  const overtime = labels.map((_, i) => { const v = byDay.get(i + 1); return v ? h1(v.ot) : 0 })
  return (
    <InfoPanel title="日ごとの勤務時間" meta={`${year}年${month}月・通常と残業`}>
      <StackedColumnChart
        label={`${year}年${month}月の日ごとの勤務時間（通常と残業）`}
        labels={labels}
        series={[{ name: '通常', values: regular, tone: 'blue' }, { name: '残業', values: overtime, tone: 'sky' }]}
        format={(n) => `${(Math.round(n * 10) / 10).toFixed(1)}`}
        tickFormat={(n) => `${n}h`}
        showTotals={false}
        height={200}
      />
    </InfoPanel>
  )
}
