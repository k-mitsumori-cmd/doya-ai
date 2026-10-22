'use client'
// ============================================
// ドヤパワー: 今日のミッション・はじめの手順・今月のドヤ実績
// ============================================
// 中身は src/lib/missions/view.ts の buildMissionsView() が組み立てる。ここは描くだけ（状態を持たない）。
// ⚠️ 新しい見た目（src/lib/ui-next.ts）のときだけ出す。判定はページ（サーバー）が行う。
// ⚠️ 演出は控えめ（ゲージが伸びるだけ）。prefers-reduced-motion では動かさない（CSS 側）。
// ⚠️ ドヤパワーの数は、台帳（ui-next/doyapower-ledger）ができるまでは記録から出した見込み。画面にもそう書く。
import Link from 'next/link'
import { UiIcon } from '@/components/icons'
import { formatMinutes, formatYen } from '@/lib/missions/achievements'
import type { MissionsView } from '@/lib/missions/view'
import type { DoyaPowerFx } from '@/lib/doya-power/fx'
import { DoyaPowerFxProvider, useDoyaPowerFx } from '@/components/doya-power/fx-context'
import DoyaPowerFxSettings from '@/components/doya-power/DoyaPowerFxSettings'
import styles from './MissionsBoard.module.css'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function dayLabel(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return ''
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}月${d}日（${WEEKDAYS[w]}）`
}

function monthLabel(monthKey: string) {
  const m = Number(monthKey.slice(5, 7))
  return m ? `${m}月` : '今月'
}

function Mark({ done }: { done: boolean }) {
  return done
    ? <span className={`${styles.mark} ${styles.markDone}`}><UiIcon name="check" size={14} strokeWidth={2.5} /></span>
    : <span className={styles.mark} />
}

export default function MissionsBoard({ view, fx, canEditOrgFx = false, sample = false }: { view: MissionsView; fx?: DoyaPowerFx; canEditOrgFx?: boolean; sample?: boolean }) {
  return (
    <DoyaPowerFxProvider fx={fx}>
      <MissionsBody view={view} canEditOrgFx={canEditOrgFx} sample={sample} />
    </DoyaPowerFxProvider>
  )
}

const sampleSave = async () => ({ ok: true as const })

function MissionsBody({ view, canEditOrgFx, sample }: { view: MissionsView; canEditOrgFx: boolean; sample: boolean }) {
  const { motion } = useDoyaPowerFx()
  const { daily, quests, power, achievements } = view
  const ratio = power.cap > 0 ? Math.min(1, power.thisMonth / power.cap) : 0
  const questsDone = quests.filter((q) => q.done).length
  const questsLeft = quests.filter((q) => !q.done).reduce((s, q) => s + q.reward, 0)
  const toolReady = (href: string) => (href.startsWith('/quote') ? view.tools.quote : href.startsWith('/sfa') ? view.tools.sfa : true)

  return (
    <div className={styles.page} data-motion={motion ? 'on' : 'off'}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>ドヤパワー</p>
          <h1 className={styles.title}>今日のミッションと<wbr />今月の実績</h1>
          <p className={styles.subtitle}>{view.companyName ? `${view.companyName} の記録から集計しています` : '記録から集計しています'}</p>
        </div>
        <Link href="/home" className={styles.back}>経営ホームへ</Link>
      </header>

      <section className={styles.power} aria-labelledby="power-h">
        <div className={styles.powerHead}>
          <h2 id="power-h" className={styles.cardTitle}>{monthLabel(achievements.monthKey)}のドヤパワー</h2>
          <p className={styles.powerNum}>
            <strong>{power.thisMonth}</strong>
            <span> / {power.cap}</span>
          </p>
        </div>
        <div className={styles.meter} role="meter" aria-valuemin={0} aria-valuemax={power.cap} aria-valuenow={power.thisMonth} aria-label="今月のドヤパワー">
          <span className={styles.meterFill} style={{ transform: `scaleX(${ratio})` }} />
        </div>
        <p className={styles.note}>
          会社ごとに、ミッションとクエストを合わせて月{power.cap}までです。いまは記録から出した見込みで、付与の記録ができたらそちらに切り替わります。
        </p>
      </section>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="daily-h">
          <div className={styles.cardHead}>
            <div>
              <p className={styles.kicker}>{dayLabel(daily.dateKey)}</p>
              <h2 id="daily-h" className={styles.cardTitle}>今日のミッション</h2>
            </div>
            <span className={daily.done ? `${styles.badge} ${styles.badgeDone}` : styles.badge}>
              {daily.done ? '達成' : `+${daily.reward}`}
            </span>
          </div>
          <p className={styles.lead}>
            {daily.done ? '今日の分は達成しました。明日またどうぞ。' : 'どれか1つで達成です（1日1回まで）。'}
          </p>
          <ul className={styles.list}>
            {daily.missions.map((m) => (
              <li key={m.id} className={styles.item}>
                <Mark done={m.done} />
                <div className={styles.itemBody}>
                  <p className={styles.itemTitle}>{m.title}</p>
                  <p className={styles.itemSub}>{m.condition}</p>
                </div>
                {!m.done && toolReady(m.href) && <Link href={m.href} className={styles.go}>開く</Link>}
              </li>
            ))}
          </ul>
          {daily.notCounted.length > 0 && (
            <div className={styles.skipped}>
              <p className={styles.skippedTitle}>今日の操作のうち、数えなかったもの</p>
              <ul>
                {daily.notCounted.map((x) => <li key={`${x.kind}-${x.id}`}>{x.reason}</li>)}
              </ul>
            </div>
          )}
        </section>

        <section className={styles.card} aria-labelledby="quest-h">
          <div className={styles.cardHead}>
            <div>
              <p className={styles.kicker}>{questsDone} / {quests.length} 完了</p>
              <h2 id="quest-h" className={styles.cardTitle}>はじめの手順</h2>
            </div>
            {questsLeft > 0 && <span className={styles.badge}>残り +{questsLeft}</span>}
          </div>
          <ul className={styles.list}>
            {quests.map((q) => (
              <li key={q.id} className={q.done ? `${styles.item} ${styles.itemDone}` : styles.item}>
                <Mark done={q.done} />
                <div className={styles.itemBody}>
                  <p className={styles.itemTitle}>{q.title}</p>
                  <p className={styles.itemSub}>{q.condition}</p>
                </div>
                <span className={styles.reward}>+{q.reward}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={styles.card} aria-labelledby="ach-h">
        <div className={styles.cardHead}>
          <div>
            <p className={styles.kicker}>{monthLabel(achievements.monthKey)}に作ったもの {achievements.totalCount}件</p>
            <h2 id="ach-h" className={styles.cardTitle}>今月のドヤ実績</h2>
          </div>
        </div>
        <div className={styles.totals}>
          <div className={styles.total}>
            <p className={styles.totalLabel}>外注に頼んだ場合（目安）</p>
            <p className={styles.totalValue}>{formatYen(achievements.totalYen)}</p>
          </div>
          <div className={styles.total}>
            <p className={styles.totalLabel}>人が作った場合の時間（目安）</p>
            <p className={styles.totalValue}>{formatMinutes(achievements.totalMinutes)}</p>
          </div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr><th scope="col">作ったもの</th><th scope="col">数</th><th scope="col">金額</th><th scope="col">時間</th></tr>
          </thead>
          <tbody>
            {achievements.lines.map((l) => (
              <tr key={l.kind} className={l.count === 0 ? styles.zero : undefined}>
                <th scope="row">
                  {l.label}
                  <span className={styles.rate}>1{l.unit} {formatYen(l.yenPerUnit)}・{formatMinutes(l.minutesPerUnit)}</span>
                </th>
                <td>{l.count}{l.unit}</td>
                <td>{formatYen(l.yen)}</td>
                <td>{formatMinutes(l.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.note}>
          単価は、クラウドソーシングや制作会社の公開の相場の低めの側に寄せた目安です。請求や契約の根拠にはしないでください。
        </p>
      </section>

      <DoyaPowerFxSettings canEditOrg={canEditOrgFx || sample} onSave={sample ? sampleSave : undefined} />
    </div>
  )
}
