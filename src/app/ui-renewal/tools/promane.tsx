'use client'

// ドヤプロマネ（見本）：ガント／カンバン、案件の収支、人件費シミュレーター。すべて架空の数字。
import { useEffect, useState, type CSSProperties } from 'react'
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import rs from '../renewal.module.css'
import p from './promane.module.css'
import { Badge, Bars, ChipSelect, Field, Glass, Slider, ServiceHero, StatTile, Tabs } from './kit'

type Task = { id: string; name: string; owner: string; start: number; end: number; pct: number; hue: number; col: number }
// 起点は 9/28（日0）。今日 10/16 = 日18。全体は 84 日（12週）
const START = new Date(2026, 8, 28)
const SPAN = 84
const TODAY = 18
const TASKS0: Task[] = [
  { id: 't1', name: '要件の整理', owner: '青山', start: 0, end: 12, pct: 100, hue: 210, col: 3 },
  { id: 't2', name: 'デザイン制作', owner: '小川', start: 8, end: 30, pct: 70, hue: 280, col: 1 },
  { id: 't3', name: '画面の開発', owner: '加藤', start: 20, end: 52, pct: 30, hue: 160, col: 1 },
  { id: 't4', name: '管理画面の開発', owner: '石川', start: 28, end: 60, pct: 10, hue: 190, col: 0 },
  { id: 't5', name: '品質チェック', owner: '清水', start: 50, end: 70, pct: 0, hue: 30, col: 0 },
  { id: 't6', name: '公開と引き渡し', owner: '青山', start: 68, end: 82, pct: 0, hue: 340, col: 0 },
  { id: 't7', name: 'デザインの確認', owner: '江口', start: 24, end: 32, pct: 40, hue: 55, col: 2 },
]
const COLS = ['未着手', '進行中', '確認待ち', '完了']
const fmt = (d: number) => {
  const x = new Date(START.getTime() + d * 86400000)
  return `${x.getMonth() + 1}/${x.getDate()}`
}

const PROJECTS = [
  { id: 'a', label: '会員サイト刷新', sales: 4800000, cost: 1500000, hours: 280 },
  { id: 'b', label: '店舗アプリ', sales: 3200000, cost: 900000, hours: 190 },
  { id: 'c', label: '採用サイト', sales: 1600000, cost: 300000, hours: 90 },
] as const
type Tab = 'gantt' | 'kanban'

/** 値が変わるたびに滑らかに数字が追いつく（スライダー操作用） */
function LiveNum({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const mv = useMotionValue(value)
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.55, ease: [0.22, 1, 0.36, 1] })
    return () => c.stop()
  }, [value, mv])
  const txt = useTransform(mv, (v) => `${prefix}${Math.round(v).toLocaleString('ja-JP')}${suffix}`)
  return <motion.span>{txt}</motion.span>
}

export default function PromaneTool() {
  const [tab, setTab] = useState<Tab>('gantt')
  const [tasks, setTasks] = useState(TASKS0)
  const [pid, setPid] = useState<(typeof PROJECTS)[number]['id']>('a')
  const proj = PROJECTS.find((x) => x.id === pid)!
  const [hours, setHours] = useState<number>(proj.hours)
  const [rate, setRate] = useState(3200)
  useEffect(() => setHours(proj.hours), [proj])
  const labor = hours * rate
  const profit = proj.sales - proj.cost - labor
  const margin = Math.round((profit / proj.sales) * 100)
  const move = (id: string) => setTasks((l) => l.map((t) => (t.id === id && t.col < 3 ? { ...t, col: t.col + 1, pct: t.col + 1 === 3 ? 100 : t.pct } : t)))
  const months = [0, 1, 2].map((i) => ({ label: `${((8 + i) % 12) + 1}月`, left: i === 0 ? 0 : ((new Date(2026, 8 + i, 1).getTime() - START.getTime()) / 86400000 / SPAN) * 100 }))

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="promane"
        catchCopy="進み具合とお金を、1画面で。"
        points={['案件ごとの予定と進捗を見える化', '作業時間から人件費を自動で計算', '利益が出ているかをすぐ確認']}
        stats={[
          { label: '進行中の案件', value: 12, unit: '件' },
          { label: '平均の利益率', value: 28, unit: '%' },
        ]}
      />

      <Glass className={p.board}>
        <div className={p.boardHead}>
          <Tabs
            id="promane"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'gantt', label: 'ガントチャート' },
              { id: 'kanban', label: 'カンバン', count: tasks.length },
            ]}
          />
          <small>案件：会員サイト刷新</small>
        </div>
        <AnimatePresence mode="wait">
          {tab === 'gantt' ? (
            <motion.div key="g" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={p.scroll}>
              <div className={p.gantt}>
                <div className={p.axis}>
                  <span />
                  <div>
                    {months.map((mo) => (
                      <b key={mo.label} style={{ left: `${mo.left}%` }}>
                        {mo.label}
                      </b>
                    ))}
                  </div>
                </div>
                {TASKS0.map((t, i) => (
                  <div key={t.id} className={p.row}>
                    <span className={p.rowName}>
                      {t.name}
                      <small>{t.owner}</small>
                    </span>
                    <div className={p.lane}>
                      <button
                        type="button"
                        className={p.bar}
                        style={{ left: `${(t.start / SPAN) * 100}%`, width: `${((t.end - t.start) / SPAN) * 100}%`, '--h': t.hue, '--i': i, '--pct': `${t.pct}%` } as CSSProperties}
                        aria-label={`${t.name} ${fmt(t.start)}から${fmt(t.end)}、進捗${t.pct}%`}
                      >
                        <span className={p.fill} />
                        <span className={p.tip} role="tooltip">
                          {t.name}　{fmt(t.start)} → {fmt(t.end)}　進捗 {t.pct}%
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
                <span className={p.today} style={{ left: `calc(150px + (100% - 150px) * ${TODAY / SPAN})` }}>
                  <em>今日</em>
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div key="k" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={p.kanban}>
              {COLS.map((c, ci) => (
                <div key={c} className={p.col}>
                  <p>
                    {c}
                    <Badge tone="muted">{tasks.filter((t) => t.col === ci).length}</Badge>
                  </p>
                  <motion.div layout className={p.cards}>
                    {tasks
                      .filter((t) => t.col === ci)
                      .map((t) => (
                        <motion.div layout layoutId={t.id} key={t.id} className={p.card} style={{ '--h': t.hue } as CSSProperties} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
                          <b>{t.name}</b>
                          <small>
                            担当 {t.owner}・期限 {fmt(t.end)}
                          </small>
                          {t.col < 3 && (
                            <button type="button" onClick={() => move(t.id)} aria-label={`${t.name}を次の列へ移す`}>
                              次へ <ArrowRight size={12} />
                            </button>
                          )}
                        </motion.div>
                      ))}
                  </motion.div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </Glass>

      <div className={p.money}>
        <Glass className={p.moneyBars}>
          <div className={p.moneyHead}>
            <b>案件の収支</b>
            <ChipSelect id="promane-proj" options={PROJECTS.map((x) => ({ id: x.id, label: x.label }))} value={pid} onChange={setPid} />
          </div>
          <Bars
            key={pid}
            unit="万円"
            data={[
              { label: '売上', value: Math.round(proj.sales / 10000) },
              { label: '原価', value: Math.round(proj.cost / 10000) },
              { label: '人件費', value: Math.round(labor / 10000) },
              { label: '利益', value: Math.max(0, Math.round(profit / 10000)), hi: true },
            ]}
            max={Math.round(proj.sales / 10000)}
          />
          <div className={p.tiles}>
            <StatTile key={`s${pid}`} label="売上" value={proj.sales / 10000} unit="万円" />
            <StatTile key={`c${pid}`} label="原価（外注など）" value={proj.cost / 10000} unit="万円" />
            <StatTile key={`p${pid}`} label="見込みの利益" value={Math.round((proj.sales - proj.cost - proj.hours * 3200) / 10000)} unit="万円" delta="初期の想定" />
          </div>
        </Glass>

        <Glass className={p.sim}>
          <b>人件費シミュレーター</b>
          <small>作業時間を動かすと、利益が変わります。</small>
          <Field label="作業時間" hint="合計">
            <Slider value={hours} min={0} max={500} step={10} onChange={setHours} format={(v) => `${v}時間`} ariaLabel="作業時間" />
          </Field>
          <Field label="1時間あたりの人件費">
            <Slider value={rate} min={2000} max={6000} step={200} onChange={setRate} format={(v) => `${v.toLocaleString()}円`} ariaLabel="1時間あたりの人件費" />
          </Field>
          <dl className={p.calc}>
            <div>
              <dt>人件費（時間 × 単価）</dt>
              <dd>
                <LiveNum value={labor} suffix="円" />
              </dd>
            </div>
            <div>
              <dt>利益</dt>
              <dd className={p.profit} data-neg={profit < 0 ? '' : undefined}>
                <LiveNum value={profit} suffix="円" />
              </dd>
            </div>
            <div>
              <dt>利益率</dt>
              <dd>
                <LiveNum value={margin} suffix="%" />
              </dd>
            </div>
          </dl>
        </Glass>
      </div>
    </div>
  )
}
