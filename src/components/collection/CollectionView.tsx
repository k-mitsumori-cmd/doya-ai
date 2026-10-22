'use client'
// ============================================
// ツール図鑑・実績バッジ・活用度スコア（画面本体）
// ============================================
// 数字・記録は props で受け取るだけ。ここで DB や API を読まない（src/lib/collection/facts.server.ts が数える）。
// ⚠️ 新しい見た目（isUiNext()）のときだけ出す。判定はページ（サーバー）が行う。
// ⚠️ 連続日数・ランキング・チームの目標・期間限定のイベントは置かない。
// ⚠️ 動きは控えめ。prefers-reduced-motion では動かさない（CSS で止める）。
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Settings2 } from 'lucide-react'
import { ShellIcon } from '@/components/shell/icons'
import type { CollectionArea, CollectionTool, ToolUsage } from '@/lib/collection/types'
import { COLLECTION_AREAS } from '@/lib/collection/types'
import { utilizationScore, usedToolIds } from '@/lib/collection/score'
import { visibleBadges, type BadgeState } from '@/lib/collection/badges'
import { loadSavedAreas, saveAreas, suggestAreas } from '@/lib/collection/areas'
import { badgeSrc, growthStage, stampSrc } from '@/lib/collection/catalog'
import styles from './collection.module.css'

const dateFmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' })
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : null)

export interface CollectionViewProps {
  tools: CollectionTool[]
  usage: Record<string, ToolUsage>
  badges: BadgeState[]
  /** 会社が使う分野。DB に持つようになったらサーバーから渡す。無ければ仮の保存 → 使った記録から仮に選ぶ */
  initialAreas?: CollectionArea[] | null
  /** 分野を選び直せるか（管理者だけ）。今は組織の権限が無いので既定は true */
  canEditAreas?: boolean
  /** 仮の保存（この端末の localStorage）を読み書きするか。見本の画面では false */
  persistAreas?: boolean
}

export default function CollectionView({ tools, usage, badges, initialAreas = null, canEditAreas = true, persistAreas = true }: CollectionViewProps) {
  const used = useMemo(() => usedToolIds(usage), [usage])
  const suggested = useMemo(() => suggestAreas(tools, used), [tools, used])
  const [saved, setSaved] = useState<CollectionArea[] | null>(initialAreas)
  useEffect(() => {
    if (initialAreas || !persistAreas) return
    const s = loadSavedAreas()
    if (s) setSaved(s)
  }, [initialAreas, persistAreas])
  const areas = saved ?? suggested
  const isProvisional = saved === null

  const score = useMemo(() => utilizationScore(tools, used, areas), [tools, used, areas])
  const shownBadges = useMemo(() => visibleBadges(badges, areas), [badges, areas])
  const earnedCount = shownBadges.filter((b) => b.earned).length

  const onSave = (next: CollectionArea[]) => {
    setSaved(next)
    if (persistAreas) saveAreas(next)
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>ドヤパワー</p>
        <h1 className={styles.title}>ツール図鑑と実績</h1>
        <p className={styles.subtitle}>使ったツールにスタンプが付き、仕事の成果に応じて実績が増えます。</p>
      </header>

      <ScoreCard score={score} areas={areas} isProvisional={isProvisional} canEdit={canEditAreas} onSave={onSave} />

      <section className={styles.section} aria-labelledby="badges-title">
        <div className={styles.sectionHead}>
          <h2 id="badges-title" className={styles.sectionTitle}>実績</h2>
          <span className={styles.sectionMeta}>{earnedCount} / {shownBadges.length} 達成</span>
        </div>
        {shownBadges.length === 0 ? (
          <p className={styles.note}>使う分野を選ぶと、その分野の実績が出ます。</p>
        ) : (
          <ul className={styles.badges}>
            {shownBadges.map((b) => <BadgeCard key={b.id} badge={b} />)}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="stamps-title">
        <div className={styles.sectionHead}>
          <h2 id="stamps-title" className={styles.sectionTitle}>ツール図鑑</h2>
          <span className={styles.sectionMeta}>{tools.filter((t) => used.has(t.id)).length} / {tools.length} 種類</span>
        </div>
        <StampBook tools={tools} usage={usage} used={used} areas={areas} />
      </section>
    </div>
  )
}

/* ---------------- 活用度スコア ---------------- */

function ScoreCard({ score, areas, isProvisional, canEdit, onSave }: {
  score: ReturnType<typeof utilizationScore>
  areas: CollectionArea[]
  isProvisional: boolean
  canEdit: boolean
  onSave: (a: CollectionArea[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<CollectionArea[]>(areas)
  const open = () => { setDraft(areas); setEditing(true) }
  const toggle = (id: CollectionArea) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))
  const next = score.areas.flatMap((a) => a.unusedTools).slice(0, 3)
  const pct = score.percent ?? 0
  const growth = growthStage(score.percent)
  const R = 52
  const C = 2 * Math.PI * R

  return (
    <section className={`${styles.card} ${styles.score}`} aria-labelledby="score-title">
      <div className={styles.scoreMain}>
        <div className={styles.ring} role="img" aria-label={score.percent === null ? '活用度はまだ出ていません' : `活用度 ${score.percent}%`}>
          <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden>
            <circle cx="60" cy="60" r={R} className={styles.ringTrack} />
            <circle cx="60" cy="60" r={R} className={styles.ringFill} strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
          </svg>
          <span className={styles.ringValue}>
            {score.percent === null ? <span className={styles.ringNone}>未設定</span> : <>{score.percent}<small>%</small></>}
          </span>
        </div>
        <div className={styles.scoreText}>
          <h2 id="score-title" className={styles.sectionTitle}>活用度</h2>
          {score.percent === null ? (
            <p className={styles.scoreLead}>会社で使う分野を選ぶと、その中でどれだけ使えているかを出します。</p>
          ) : (
            <p className={styles.scoreLead}>会社で使う分野の <b>{score.total}</b> ツールのうち、<b>{score.used}</b> ツールを使っています。</p>
          )}
          <p className={styles.scoreNote}>
            選んでいない分野と、開発中のツールは計算に入れません。
            {isProvisional && areas.length > 0 ? ' 今は使った記録から仮に選んでいます。' : ''}
          </p>
          {canEdit && !editing ? (
            <button type="button" className={styles.ghost} onClick={open}>
              <Settings2 size={16} aria-hidden />使う分野を選ぶ
            </button>
          ) : null}
        </div>
        {growth ? (
          <figure className={styles.growth}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={growth.src} alt="" width={144} height={120} className={styles.growthImg} decoding="async" />
            <figcaption className={styles.growthCaption}>
              <span className={styles.growthLabel}>ドヤくん：{growth.label}</span>
              <span className={styles.growthNext}>{growth.next === null ? 'いちばん上の段階です' : `活用度 ${growth.next}% で次の段階`}</span>
            </figcaption>
          </figure>
        ) : null}
      </div>

      {editing ? (
        <fieldset className={styles.areaPicker}>
          <legend className={styles.areaLegend}>会社で使う分野</legend>
          <div className={styles.areaOptions}>
            {COLLECTION_AREAS.map((a) => {
              const on = draft.includes(a.id)
              return (
                <label key={a.id} className={styles.areaOption} data-on={on ? 'true' : undefined}>
                  <input type="checkbox" checked={on} onChange={() => toggle(a.id)} className={styles.srOnly} />
                  <span className={styles.areaCheck} aria-hidden>{on ? <Check size={14} /> : null}</span>
                  <span>
                    <span className={styles.areaName}>{a.label}</span>
                    <span className={styles.areaHint}>{a.hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <div className={styles.areaActions}>
            <button type="button" className={styles.primary} onClick={() => { onSave(draft); setEditing(false) }}>この分野で計算する</button>
            <button type="button" className={styles.ghost} onClick={() => setEditing(false)}>やめる</button>
          </div>
        </fieldset>
      ) : null}

      {score.areas.length > 0 ? (
        <ul className={styles.areaBars}>
          {score.areas.map((a) => (
            <li key={a.area} className={styles.areaBar}>
              <span className={styles.areaBarLabel}>{a.label}</span>
              <span className={styles.bar} aria-hidden><span className={styles.barFill} style={{ width: `${a.percent ?? 0}%` }} /></span>
              <span className={styles.areaBarValue}>{a.used} / {a.total}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {next.length > 0 ? (
        <div className={styles.next}>
          <p className={styles.nextTitle}>次に試すと良いツール</p>
          <ul className={styles.nextList}>
            {next.map((t) => (
              <li key={t.id}>
                <Link href={t.href} className={styles.nextItem}>
                  <ShellIcon name={t.icon} size={16} />{t.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

/* ---------------- 実績バッジ ---------------- */

function BadgeCard({ badge: b }: { badge: BadgeState }) {
  const date = fmtDate(b.earnedAt)
  return (
    <li className={styles.badge} data-earned={b.earned ? 'true' : undefined}>
      {badgeSrc(b.id) ? (
        <span className={styles.badgeArt} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeSrc(b.id)!} alt="" width={56} height={56} className={styles.badgeImg} loading="lazy" decoding="async" />
        </span>
      ) : (
        <span className={styles.badgeIcon}><ShellIcon name={b.icon} size={22} /></span>
      )}
      <span className={styles.badgeBody}>
        <span className={styles.badgeTitle}>{b.title}</span>
        {b.earned ? (
          <span className={styles.badgeSub}>{date ? `達成（最初の記録 ${date}）` : '達成'}</span>
        ) : (
          <>
            <span className={styles.badgeSub}>{b.how}</span>
            {b.target > 1 ? (
              <span className={styles.badgeProgress}>
                <span className={styles.bar} aria-hidden><span className={styles.barFill} style={{ width: `${(b.current / b.target) * 100}%` }} /></span>
                <span className={styles.badgeCount}>{b.current} / {b.target}</span>
              </span>
            ) : null}
          </>
        )}
      </span>
      {b.earned ? <span className={styles.badgeDone}><Check size={14} aria-hidden />達成</span> : <Link href={b.href} className={styles.badgeLink}>開く</Link>}
    </li>
  )
}

/* ---------------- ツール図鑑（スタンプカード） ---------------- */

function StampBook({ tools, usage, used, areas }: {
  tools: CollectionTool[]
  usage: Record<string, ToolUsage>
  used: ReadonlySet<string>
  areas: CollectionArea[]
}) {
  const mine = COLLECTION_AREAS.filter((a) => areas.includes(a.id))
  const others = COLLECTION_AREAS.filter((a) => !areas.includes(a.id))
  const group = (a: (typeof COLLECTION_AREAS)[number]) => {
    const list = tools.filter((t) => t.area === a.id)
    if (list.length === 0) return null
    return (
      <div key={a.id} className={styles.stampGroup}>
        <h3 className={styles.groupTitle}>{a.label}<span className={styles.groupCount}>{list.filter((t) => used.has(t.id)).length} / {list.length}</span></h3>
        <ul className={styles.stamps}>
          {list.map((t) => <StampCard key={t.id} tool={t} usage={usage[t.id]} used={used.has(t.id)} />)}
        </ul>
      </div>
    )
  }
  return (
    <>
      {(mine.length ? mine : COLLECTION_AREAS).map(group)}
      {mine.length && others.length ? (
        <details className={styles.others}>
          <summary className={styles.othersSummary}>
            <ChevronDown size={16} aria-hidden className={styles.othersChevron} />
            ほかの分野のツール（活用度には入れません）
          </summary>
          {others.map(group)}
        </details>
      ) : null}
    </>
  )
}

function StampCard({ tool: t, usage, used }: { tool: CollectionTool; usage?: ToolUsage; used: boolean }) {
  const src = stampSrc(t.id)
  const first = fmtDate(usage?.firstAt ?? null)
  return (
    <li className={styles.stampCard} data-used={used ? 'true' : undefined}>
      <span className={styles.stamp} aria-hidden data-img={src && used ? 'true' : undefined}>
        {src && used ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" width={72} height={72} className={styles.stampImg} loading="lazy" decoding="async" />
        ) : (
          <ShellIcon name={t.icon} size={28} />
        )}
      </span>
      <span className={styles.stampName}>
        {t.name}
        {t.beta ? <span className={styles.beta}>開発中</span> : null}
      </span>
      {used ? (
        <span className={styles.stampSub}>{first ? `${first}から` : '使っています'}</span>
      ) : (
        <>
          <span className={styles.stampSub}>まだ使っていません</span>
          <Link href={t.href} className={styles.stampLink} aria-label={`${t.name}を開く`}>開く</Link>
        </>
      )}
      <span className={styles.srOnly}>{used ? 'スタンプあり' : 'スタンプなし'}</span>
    </li>
  )
}
