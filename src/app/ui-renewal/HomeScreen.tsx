'use client'

import { useState, type CSSProperties } from 'react'
import { ArrowRight, ArrowUpRight, Flame, Image as Images, Building2, TrendingUp } from 'lucide-react'
import s from './renewal.module.css'
import { CountUp, Ring, SplitText, useInView, useReveal } from './motion'
import { HOME, RECENT, STAGES, SUGGESTIONS, type StageId } from './data'
import { getServiceById } from '@/lib/services'

const stageOf = (id: StageId) => STAGES.find((st) => st.id === id)!

export function HomeScreen({ onOpen }: { onOpen: (serviceId: string) => void }) {
  const root = useReveal<HTMLDivElement>()
  const today = new Date()
  const dateLabel = today.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <div ref={root} className={s.screen}>
      <header className={s.homeHead}>
        <p className={s.eyebrow} data-reveal>
          <span className={s.eyebrowNo}>{dateLabel}</span>
          <span>WORKSPACE</span>
        </p>
        <h1 className={s.homeTitle}>
          <SplitText text={`おはようございます、${HOME.userName}さん。`} />
        </h1>
        <p className={s.homeLead} data-reveal style={{ '--d': '.35s' } as CSSProperties}>
          今月、AIチームが代わりに進めた仕事をまとめました。
        </p>
      </header>

      <SavedHours />

      <section className={s.kpiRow}>
        <KpiOutputs />
        <KpiRemaining />
        <KpiPrepared />
        <KpiStreak />
      </section>

      <section className={s.twoCol}>
        <WeeklyChart />
        <ShareDonut />
      </section>

      <section className={s.block}>
        <div className={s.blockHead} data-reveal>
          <h2 className={s.h2}>次にやると、効きそうなこと</h2>
          <p className={s.blockNote}>利用状況から、AIが3つ選びました</p>
        </div>
        <div className={s.suggestGrid}>
          {SUGGESTIONS.map((sg, i) => {
            const svc = getServiceById(sg.serviceId)
            return (
              <button
                key={sg.serviceId}
                type="button"
                className={s.suggest}
                data-reveal
                style={{ '--d': `${i * 0.08}s` } as CSSProperties}
                onClick={() => onOpen(sg.serviceId)}
              >
                <img src={sg.image} alt="" className={s.suggestImg} width={88} height={88} loading="lazy" />
                <span className={s.suggestTag}>{svc?.name}</span>
                <span className={s.suggestTitle}>{sg.title}</span>
                <span className={s.suggestBody}>{sg.body}</span>
                <span className={s.suggestGo}>
                  開く <ArrowRight size={14} strokeWidth={2} />
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className={s.block}>
        <div className={s.blockHead} data-reveal>
          <h2 className={s.h2}>最近つくったもの</h2>
          <button type="button" className={s.textLink} onClick={() => onOpen('banner')}>
            すべて見る <ArrowUpRight size={14} strokeWidth={2} />
          </button>
        </div>
        <div className={s.recentGrid}>
          {RECENT.map((r, i) => (
            <figure key={r.src} className={s.recent} data-reveal="img" style={{ '--d': `${i * 0.1}s` } as CSSProperties}>
              <div className={s.recentImg}>
                <img src={r.src} alt={r.title} loading="lazy" />
              </div>
              <figcaption>
                <strong>{r.title}</strong>
                <span>
                  {r.service}・{r.when}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  )
}

// ---- 今月の削減時間：1マス=1時間のマス目で「どれだけ任せたか」を見せる ----
function SavedHours() {
  const [ref, seen] = useInView<HTMLElement>()
  const cells = Array.from({ length: HOME.goalHours }, (_, i) => i)
  // 各マスの色＝そのマスの時間帯を担った業務
  const bounds: { stage: StageId; to: number }[] = []
  let acc = 0
  for (const sh of HOME.share) {
    acc += sh.hours
    bounds.push({ stage: sh.stage, to: acc })
  }
  const colorAt = (i: number) => {
    const b = bounds.find((x) => i < x.to)
    return b ? stageOf(b.stage).color : 'transparent'
  }
  const yen = Math.round((HOME.savedHours * HOME.hourlyYen) / 1000) / 10

  return (
    <section ref={ref} className={`${s.hero} ${seen ? s.on : ''}`}>
      <div className={s.heroCopy}>
        <img src="/character/success-256.webp" alt="" className={s.heroMascot} width={150} height={150} />
        <p className={s.heroLabel}>今月AIに任せられた時間</p>
        <p className={s.heroNum}>
          <CountUp value={HOME.savedHours} decimals={1} start={seen} duration={2000} />
          <span className={s.heroUnit}>時間</span>
        </p>
        <p className={s.heroSub}>
          人の手でやると 約<strong>{yen}万円</strong> 分の作業です
          <span className={s.heroFoot}>時給{HOME.hourlyYen.toLocaleString()}円で換算・見本の数値</span>
        </p>
        <ul className={s.legend}>
          {HOME.share.map((sh) => {
            const st = stageOf(sh.stage)
            return (
              <li key={sh.stage}>
                <i style={{ background: st.color }} />
                {st.label}
                <b>{sh.hours}h</b>
              </li>
            )
          })}
        </ul>
      </div>
      <div className={s.hourGridWrap}>
        <div className={s.hourGrid} role="img" aria-label={`目標${HOME.goalHours}時間のうち${HOME.savedHours}時間`}>
          {cells.map((i) => {
            const fill = Math.max(0, Math.min(1, HOME.savedHours - i))
            return (
              <span key={i} className={s.cell} style={{ '--i': i } as CSSProperties}>
                {fill > 0 && (
                  <span
                    className={s.cellFill}
                    style={{ background: colorAt(i), '--fill': fill } as CSSProperties}
                  />
                )}
              </span>
            )
          })}
        </div>
        <div className={s.hourScale}>
          <span>0</span>
          <span>目標 {HOME.goalHours}時間</span>
        </div>
      </div>
    </section>
  )
}

function KpiCard({
  icon,
  label,
  children,
  foot,
  delay,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  foot?: React.ReactNode
  delay: number
}) {
  return (
    <article className={s.kpi} data-reveal style={{ '--d': `${delay}s` } as CSSProperties}>
      <span className={s.kpiIcon}>{icon}</span>
      <p className={s.kpiLabel}>{label}</p>
      <div className={s.kpiBody}>{children}</div>
      {foot && <p className={s.kpiFoot}>{foot}</p>}
    </article>
  )
}

function KpiOutputs() {
  const [ref, seen] = useInView<HTMLDivElement>()
  return (
    <KpiCard icon={<Images size={18} strokeWidth={1.75} />} label="今月つくった成果物" delay={0}>
      <div ref={ref} className={s.kpiNumRow}>
        <span className={s.kpiNum}>
          <CountUp value={HOME.outputs} start={seen} />
        </span>
        <span className={s.kpiUnit}>件</span>
        <span className={s.delta}>
          <TrendingUp size={13} strokeWidth={2} /> +{HOME.outputsDelta}%
        </span>
      </div>
      <div className={s.miniBars} aria-hidden="true">
        {HOME.weekly.map((w, i) => (
          <span key={w.label} style={{ '--h': w.value / 27, '--i': i } as CSSProperties} className={seen ? s.on : ''} />
        ))}
      </div>
    </KpiCard>
  )
}

function KpiRemaining() {
  const [ref, seen] = useInView<HTMLDivElement>()
  return (
    <KpiCard icon={<Flame size={18} strokeWidth={1.75} />} label="今日の残り回数" foot="毎朝0時にリセット" delay={0.08}>
      <div ref={ref} className={s.kpiRingRow}>
        <Ring value={HOME.remaining} max={HOME.dailyLimit} size={78} stroke={8} start={seen}>
          <b>{Math.round((HOME.remaining / HOME.dailyLimit) * 100)}%</b>
        </Ring>
        <p className={s.kpiRingText}>
          <span className={s.kpiNum}>
            <CountUp value={HOME.remaining} start={seen} />
          </span>
          <span className={s.kpiUnit}>/ {HOME.dailyLimit}回</span>
        </p>
      </div>
    </KpiCard>
  )
}

function KpiPrepared() {
  const [ref, seen] = useInView<HTMLDivElement>()
  return (
    <KpiCard icon={<Building2 size={18} strokeWidth={1.75} />} label="準備ずみの商談" foot="明日の予定 2社が未準備" delay={0.16}>
      <div ref={ref} className={s.kpiNumRow}>
        <span className={s.kpiNum}>
          <CountUp value={HOME.prepared} start={seen} />
        </span>
        <span className={s.kpiUnit}>社</span>
      </div>
      <div className={s.dotsRow} aria-hidden="true">
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} className={`${s.dot} ${i < HOME.prepared ? s.dotOn : ''} ${seen ? s.on : ''}`} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
    </KpiCard>
  )
}

function KpiStreak() {
  const [ref, seen] = useInView<HTMLDivElement>()
  return (
    <KpiCard icon={<Flame size={18} strokeWidth={1.75} />} label="連続で使った日数" foot="直近14日" delay={0.24}>
      <div ref={ref} className={s.kpiNumRow}>
        <span className={s.kpiNum}>
          <CountUp value={HOME.streak} start={seen} />
        </span>
        <span className={s.kpiUnit}>日</span>
      </div>
      <div className={s.heat} aria-hidden="true">
        {HOME.streakDays.map((lv, i) => (
          <span key={i} data-lv={lv} className={seen ? s.on : ''} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
    </KpiCard>
  )
}

// ---- 週ごとの成果物：棒が伸びて、上を線がなぞる ----
function WeeklyChart() {
  const [ref, seen] = useInView<HTMLElement>()
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 240
  const padX = 28
  const padTop = 28
  const padBottom = 34
  const max = 30
  const n = HOME.weekly.length
  const step = (W - padX * 2) / n
  const x = (i: number) => padX + step * i + step / 2
  const y = (v: number) => padTop + (H - padTop - padBottom) * (1 - v / max)
  const line = HOME.weekly.map((w, i) => `${i ? 'L' : 'M'}${x(i)},${y(w.value)}`).join(' ')
  const area = `${line} L${x(n - 1)},${H - padBottom} L${x(0)},${H - padBottom} Z`

  return (
    <article ref={ref} className={`${s.card} ${s.chartCard} ${seen ? s.on : ''}`} data-reveal>
      <div className={s.cardHead}>
        <div>
          <h2 className={s.h3}>週ごとの成果物</h2>
          <p className={s.cardNote}>直近8週・すべてのサービス合計</p>
        </div>
        <span className={s.pill}>+3倍 / 8週</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={s.chart} role="img" aria-label="週ごとの成果物の推移">
        <defs>
          <linearGradient id="rn-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0066ff" stopOpacity=".22" />
            <stop offset="1" stopColor="#0066ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 10, 20, 30].map((t) => (
          <g key={t}>
            <line x1={padX} x2={W - padX} y1={y(t)} y2={y(t)} className={s.gridLine} />
            <text x={padX - 8} y={y(t) + 4} className={s.axisText} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {HOME.weekly.map((w, i) => (
          <g key={w.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={x(i) - step / 2} y={padTop} width={step} height={H - padTop - padBottom} fill="transparent" />
            <rect
              className={s.bar}
              x={x(i) - 13}
              y={y(w.value)}
              width={26}
              height={H - padBottom - y(w.value)}
              rx={7}
              style={{ '--i': i } as CSSProperties}
              data-active={hover === i || (hover === null && i === n - 1) ? '' : undefined}
            />
            <text x={x(i)} y={H - 12} className={s.axisText} textAnchor="middle">
              {w.label}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#rn-area)" className={s.area} />
        <path d={line} className={s.line} pathLength={1} />
        {HOME.weekly.map((w, i) => (
          <circle key={w.label} cx={x(i)} cy={y(w.value)} r={hover === i ? 6 : 4} className={s.linePt} style={{ '--i': i } as CSSProperties} />
        ))}
        {(() => {
          const i = hover ?? n - 1
          const w = HOME.weekly[i]
          const tx = Math.min(W - padX - 64, Math.max(padX, x(i) - 32))
          return (
            <g className={s.tip} transform={`translate(${tx}, ${y(w.value) - 44})`}>
              <rect width={64} height={30} rx={8} />
              <text x={32} y={20} textAnchor="middle">
                {w.value}件
              </text>
            </g>
          )
        })()}
      </svg>
    </article>
  )
}

// ---- 何を任せたか：ドーナツが順に描かれる ----
function ShareDonut() {
  const [ref, seen] = useInView<HTMLElement>()
  const total = HOME.share.reduce((a, b) => a + b.hours, 0)
  const size = 168
  const stroke = 22
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gap = 4
  let offset = 0
  const segs = HOME.share.map((sh, i) => {
    const len = (sh.hours / total) * c
    const seg = { ...sh, len: Math.max(0, len - gap), start: offset, i }
    offset += len
    return seg
  })
  const [active, setActive] = useState<StageId | null>(null)
  const focus = active ? HOME.share.find((x) => x.stage === active)! : null

  return (
    <article ref={ref} className={`${s.card} ${s.donutCard} ${seen ? s.on : ''}`} data-reveal style={{ '--d': '.1s' } as CSSProperties}>
      <div className={s.cardHead}>
        <div>
          <h2 className={s.h3}>どの仕事を任せたか</h2>
          <p className={s.cardNote}>削減時間の内訳</p>
        </div>
      </div>
      <div className={s.donutBody}>
        <div className={s.donut}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(10,15,60,.06)" strokeWidth={stroke} />
            {segs.map((sg) => {
              const st = stageOf(sg.stage)
              return (
                <circle
                  key={sg.stage}
                  className={s.donutSeg}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={st.color}
                  strokeWidth={active === sg.stage ? stroke + 6 : stroke}
                  strokeDasharray={`${sg.len} ${c}`}
                  strokeDashoffset={seen ? -sg.start : -sg.start + sg.len}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  style={{ '--i': sg.i, opacity: active && active !== sg.stage ? 0.25 : 1 } as CSSProperties}
                  onMouseEnter={() => setActive(sg.stage)}
                  onMouseLeave={() => setActive(null)}
                />
              )
            })}
          </svg>
          <div className={s.donutCenter}>
            <b>{focus ? Math.round((focus.hours / total) * 100) : 100}%</b>
            <span>{focus ? stageOf(focus.stage).label : '合計'}</span>
          </div>
        </div>
        <ul className={s.shareList}>
          {HOME.share.map((sh, i) => {
            const st = stageOf(sh.stage)
            return (
              <li
                key={sh.stage}
                onMouseEnter={() => setActive(sh.stage)}
                onMouseLeave={() => setActive(null)}
                data-dim={active && active !== sh.stage ? '' : undefined}
              >
                <span className={s.shareName}>
                  <i style={{ background: st.color }} />
                  {st.label}
                </span>
                <span className={s.shareBar}>
                  <span style={{ background: st.color, '--w': sh.hours / HOME.share[0].hours, '--i': i } as CSSProperties} />
                </span>
                <b>{sh.hours}h</b>
              </li>
            )
          })}
        </ul>
      </div>
    </article>
  )
}
