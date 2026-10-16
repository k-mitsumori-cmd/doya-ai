'use client'

// ドヤ営業管理：全幅ダッシュボード。カンバンは、ドラッグかボタンで列を移れる。
// 見本のためデータはすべて架空。DBや生成APIは呼ばない。
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, GripVertical, RotateCcw } from 'lucide-react'
import rs from '../renewal.module.css'
import { Badge, Bars, Glass, ServiceHero, Sparkline, StatTile, Tabs } from './kit'
import { getServiceById } from '@/lib/services'
import css from './sfa.module.css'

const COLS = [
  { id: 'lead', label: '見込み', prob: 10 },
  { id: 'prop', label: '提案', prob: 30 },
  { id: 'quote', label: '見積', prob: 50 },
  { id: 'nego', label: '交渉', prob: 75 },
  { id: 'won', label: '受注', prob: 100 },
] as const
type ColId = (typeof COLS)[number]['id']

type Deal = { id: string; company: string; title: string; amount: number; col: ColId; owner: string }
const SEED: Deal[] = [
  { id: 'd1', company: '青葉テック', title: '予約システムの入れ替え', amount: 240, col: 'lead', owner: '田' },
  { id: 'd2', company: 'みなと食品', title: '受発注の一元化', amount: 180, col: 'lead', owner: '佐' },
  { id: 'd3', company: '北斗レンタル', title: '顧客管理の新規導入', amount: 320, col: 'prop', owner: '田' },
  { id: 'd4', company: 'つばさ学園', title: '問い合わせ対応の自動化', amount: 150, col: 'prop', owner: '鈴' },
  { id: 'd5', company: '森のパン工房', title: '会員アプリの開発', amount: 90, col: 'quote', owner: '佐' },
  { id: 'd6', company: 'ひかり不動産', title: '内見予約の仕組み化', amount: 410, col: 'quote', owner: '田' },
  { id: 'd7', company: '大和メディカル', title: '営業支援の全社展開', amount: 560, col: 'nego', owner: '鈴' },
  { id: 'd8', company: 'さくら運輸', title: '配車表のクラウド化', amount: 270, col: 'nego', owner: '佐' },
  { id: 'd9', company: '丘の上ホテル', title: '宿泊予約の連携', amount: 200, col: 'won', owner: '田' },
]

const TASKS = [
  { id: 't1', text: '大和メディカルへ最終見積を送る', time: '10:00' },
  { id: 't2', text: '北斗レンタルの提案資料を仕上げる', time: '13:30' },
  { id: 't3', text: 'みなと食品に初回の電話をかける', time: '15:00' },
  { id: 't4', text: 'さくら運輸の契約書を確認する', time: '17:00' },
]

const MONTHS = [310, 360, 330, 420, 480, 450, 540]
const yenMan = (n: number) => `${n.toLocaleString('ja-JP')}万円`

export default function SfaTool() {
  const svc = getServiceById('sfa')
  const [deals, setDeals] = useState<Deal[]>(SEED)
  const [tasks, setTasks] = useState(TASKS)
  const [checking, setChecking] = useState<string[]>([])
  const [over, setOver] = useState<ColId | null>(null)
  const [view, setView] = useState<'board' | 'chart'>('board')
  const colRefs = useRef<Partial<Record<ColId, HTMLDivElement | null>>>({})

  const move = (id: string, to: ColId) => setDeals((cur) => cur.map((d) => (d.id === id ? { ...d, col: to } : d)))
  const next = (c: ColId) => COLS[Math.min(COLS.findIndex((x) => x.id === c) + 1, COLS.length - 1)].id

  const colAt = (x: number, y: number): ColId | null => {
    for (const c of COLS) {
      const r = colRefs.current[c.id]?.getBoundingClientRect()
      if (r && x >= r.left && x <= r.right && y >= r.top - 40 && y <= r.bottom + 40) return c.id
    }
    return null
  }

  const probOf = (c: ColId) => COLS.find((x) => x.id === c)!.prob
  const won = deals.filter((d) => d.col === 'won').reduce((a, d) => a + d.amount, 0)
  const open = deals.filter((d) => d.col !== 'won')
  const weighted = Math.round(open.reduce((a, d) => a + (d.amount * probOf(d.col)) / 100, 0))
  const rate = Math.round((deals.filter((d) => d.col === 'won').length / deals.length) * 100)
  const series = useMemo(() => [...MONTHS, 540 + won], [won])

  const bars = [...open]
    .sort((a, b) => probOf(b.col) - probOf(a.col) || b.amount - a.amount)
    .slice(0, 6)
    .map((d) => ({ label: d.company.slice(0, 5), value: probOf(d.col), hi: probOf(d.col) >= 75 }))

  const check = (id: string) => {
    setChecking((c) => [...c, id])
    window.setTimeout(() => setTasks((t) => t.filter((x) => x.id !== id)), 650)
  }
  const reset = () => {
    setDeals(SEED)
    setTasks(TASKS)
    setChecking([])
  }

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="sfa"
        catchCopy={`${svc?.shortName ?? '営業管理'}は、動かして見える`}
        points={['商談をカードで並べて、ドラッグで進める', '売上と受注の見込みがすぐわかる', '今日やることを忘れない']}
        stats={[
          { label: '今月の受注見込み', value: 1840, unit: '万円' },
          { label: '商談の数', value: 9, unit: '件' },
        ]}
      />

      <div className={css.top}>
        <StatTile label="受注額（今期）" value={won} unit="万円" delta={won > 200 ? `+${won - 200}万円` : '前回と同じ'} />
        <StatTile label="見込み（確度で加重）" value={weighted} unit="万円" delta="加重合計" />
        <StatTile label="受注率" value={rate} unit="%" delta={`${deals.filter((d) => d.col === 'won').length} / ${deals.length}件`} />
        <Glass className={css.spark}>
          <small>月ごとの売上（万円）</small>
          <Sparkline data={series} height={52} />
        </Glass>
      </div>

      <div className={css.boardHead}>
        <Tabs
          id="sfa-view"
          value={view}
          onChange={setView}
          tabs={[
            { id: 'board', label: '商談パイプライン', count: deals.length },
            { id: 'chart', label: '受注確度の順' },
          ]}
        />
        <button type="button" className={css.reset} onClick={reset}>
          <RotateCcw size={13} strokeWidth={2.4} />
          最初の状態に戻す
        </button>
      </div>

      <div className={css.main}>
        <div className={css.left}>
          {view === 'board' ? (
            <div className={css.board}>
              {COLS.map((c) => {
                const list = deals.filter((d) => d.col === c.id)
                const sum = list.reduce((a, d) => a + d.amount, 0)
                return (
                  <div
                    key={c.id}
                    className={css.col}
                    data-over={over === c.id ? '' : undefined}
                    data-won={c.id === 'won' ? '' : undefined}
                    ref={(el) => {
                      colRefs.current[c.id] = el
                    }}
                  >
                    <p className={css.colHead}>
                      <span>{c.label}</span>
                      <b>{list.length}</b>
                      <small>{yenMan(sum)}</small>
                    </p>
                    <div className={css.cards}>
                      {list.map((d) => (
                        <motion.div
                          key={d.id}
                          layout
                          layoutId={d.id}
                          className={css.card}
                          drag
                          dragSnapToOrigin
                          dragElastic={0.12}
                          whileDrag={{ scale: 1.04, rotate: 2, zIndex: 30, boxShadow: '0 18px 40px rgba(60,40,160,0.35)' }}
                          onDrag={(e) => {
                            const p = e as PointerEvent
                            setOver(colAt(p.clientX, p.clientY))
                          }}
                          onDragEnd={(e) => {
                            const p = e as PointerEvent
                            const to = colAt(p.clientX, p.clientY)
                            setOver(null)
                            if (to && to !== d.col) move(d.id, to)
                          }}
                          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                        >
                          <span className={css.grip} aria-hidden="true">
                            <GripVertical size={14} strokeWidth={2} />
                          </span>
                          <p className={css.cCompany}>{d.company}</p>
                          <p className={css.cTitle}>{d.title}</p>
                          <div className={css.cFoot}>
                            <b>{yenMan(d.amount)}</b>
                            <span className={css.owner}>{d.owner}</span>
                            {c.id !== 'won' ? (
                              <button type="button" className={css.nextBtn} onClick={() => move(d.id, next(d.col))} aria-label={`${d.company}を次の列へ移す`}>
                                <ArrowRight size={13} strokeWidth={2.6} />
                              </button>
                            ) : (
                              <Badge tone="ok">受注</Badge>
                            )}
                          </div>
                        </motion.div>
                      ))}
                      {list.length === 0 && <p className={css.empty}>ここへドラッグ</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Glass className={css.chartCard}>
              <p className={css.cardTitle}>受注確度が高い順（受注前の商談）</p>
              <Bars data={bars} max={100} unit="%" />
            </Glass>
          )}
          <p className={css.hint}>カードはドラッグで別の列へ。右下の矢印で次の列へ進めることもできます。</p>
        </div>

        <Glass className={css.tasks}>
          <p className={css.cardTitle}>
            今日のタスク
            <Badge tone="grad">{tasks.length}件</Badge>
          </p>
          <ul>
            <AnimatePresence initial={false}>
              {tasks.map((t) => {
                const on = checking.includes(t.id)
                return (
                  <motion.li
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40, height: 0, marginTop: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  >
                    <button type="button" className={css.task} data-on={on ? '' : undefined} onClick={() => check(t.id)}>
                      <span className={css.box}>{on && <Check size={12} strokeWidth={3.4} />}</span>
                      <span className={css.tText}>{t.text}</span>
                      <small>{t.time}</small>
                    </button>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
          {tasks.length === 0 && (
            <motion.p className={css.allDone} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              今日のタスクはすべて完了です
            </motion.p>
          )}
        </Glass>
      </div>
    </div>
  )
}
