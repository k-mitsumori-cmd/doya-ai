'use client'
// ============================================
// 人事のインフォグラフィック（2026-10-27 ユーザー「人事（組織図など）もインフォグラフィックのアニメーションで分かりやすく」）
// ============================================
// - HeadcountInfo: ダッシュボードの「部署ごとの人数」。割合の円（回って出る）と、人数の横棒（伸びる）
// ⚠️ 取得はしない。/api/hr/dashboard の departmentHeadcount を受け取って並べるだけ
import { Bars, Donut } from '@/components/ds/charts'
import { Button } from '@/components/ds'
import { InfoEmpty, InfoPanel, InfoPanelLoading, InfoReserve } from '@/components/ds/infographic'

/** 読み込み中の枠の高さ（px。6部署のときの中身の実測。1280px と 375px） */
const HEADCOUNT_H = 310
const HEADCOUNT_H_SM = 589
import { CountUp } from '@/components/ds/motion'

export function HeadcountInfo({ rows, total }: { rows: { name: string; count: number }[]; total: number }) {
  // 円は5区分まで（青の濃淡で見分けられる数）。入りきらない部署は「その他」にまとめる
  // 部署に入っていない人も円に入れ、中央の在籍の数と円の合計をそろえる
  const unassigned = Math.max(0, total - rows.reduce((a, r) => a + r.count, 0))
  const room = unassigned > 0 ? 4 : 5
  const base = rows.length > room
    ? [...rows.slice(0, room - 1).map((r) => ({ label: r.name, value: r.count })), { label: 'その他', value: rows.slice(room - 1).reduce((a, r) => a + r.count, 0) }]
    : rows.map((r) => ({ label: r.name, value: r.count }))
  const donut = unassigned > 0 ? [...base, { label: '部署なし', value: unassigned }] : base
  return (
    <InfoPanel title="部署ごとの人数" meta={`在籍 ${total} 名・${rows.length} 部署`}>
      <InfoReserve height={HEADCOUNT_H} mobileHeight={HEADCOUNT_H_SM}>
      {rows.length === 0 ? (
        <div className="grid justify-items-center gap-3">
          <InfoEmpty>部署を登録すると、部署ごとの人数がここに出ます。</InfoEmpty>
          <Button href="/hr/settings" icon="Settings" variant="secondary">部署を登録する</Button>
        </div>
      ) : (
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
      )}
      </InfoReserve>
    </InfoPanel>
  )
}

/** 読み込みの間に、同じ高さの枠を出しておく（読み込みのあとに下を押し下げない。高さは 6部署のときの実測） */
export function HeadcountInfoLoading() {
  return <InfoPanelLoading title="部署ごとの人数" height={HEADCOUNT_H} mobileHeight={HEADCOUNT_H_SM} />
}
