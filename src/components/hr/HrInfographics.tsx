'use client'
// ============================================
// 人事のインフォグラフィック（2026-10-27 ユーザー「人事（組織図など）もインフォグラフィックのアニメーションで分かりやすく」）
// ============================================
// - HeadcountInfo: ダッシュボードの「部署ごとの人数」。割合の円（回って出る）と、人数の横棒（伸びる）
// ⚠️ 取得はしない。/api/hr/dashboard の departmentHeadcount を受け取って並べるだけ
import { Bars, Donut } from '@/components/ds/charts'
import { InfoPanel } from '@/components/ds/infographic'
import { Skeleton } from '@/components/ds'
import { CountUp } from '@/components/ds/motion'

export function HeadcountInfo({ rows, total }: { rows: { name: string; count: number }[]; total: number }) {
  // 円は5区分まで（青の濃淡で見分けられる数）。6つ目からは「その他」にまとめる
  const donut = rows.length > 5
    ? [...rows.slice(0, 4).map((r) => ({ label: r.name, value: r.count })), { label: 'その他', value: rows.slice(4).reduce((a, r) => a + r.count, 0) }]
    : rows.map((r) => ({ label: r.name, value: r.count }))
  return (
    <InfoPanel title="部署ごとの人数" meta={`在籍 ${total} 名・${rows.length} 部署`}>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Donut
          data={donut}
          size={176}
          palette="blue"
          label="部署ごとの在籍人数の割合"
          center={<span style={{ display: 'grid', lineHeight: 1.2 }}><small style={{ fontSize: 11, fontWeight: 700, color: 'var(--sub)' }}>在籍</small><span style={{ fontSize: 24 }}><CountUp value={total} /><small style={{ fontSize: 12 }}>名</small></span></span>}
        />
        <div className="grid gap-2">
          {/* 横棒は多い順に6部署まで（高さを決めて、読み込みのあとに下を押し下げない） */}
          <Bars data={rows.slice(0, 6).map((r) => ({ label: r.name, value: r.count }))} format={(n) => `${n}名`} />
          {rows.length > 6 ? <p className="m-0 text-[13px] font-bold text-[var(--sub)]">ほか {rows.length - 6} 部署（組織図で確認できます）</p> : null}
        </div>
      </div>
    </InfoPanel>
  )
}

/** 読み込みの間に、同じ高さの枠を出しておく（読み込みのあとに下を押し下げない） */
export function HeadcountInfoLoading() {
  return (
    <InfoPanel title="部署ごとの人数">
      <div aria-busy="true" aria-label="読み込み中" style={{ minHeight: 300 }}>
        <Skeleton lines={6} height={22} delayMs={0} />
      </div>
    </InfoPanel>
  )
}
