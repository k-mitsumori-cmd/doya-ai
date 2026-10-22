'use client'

import Link from 'next/link'
import type { HomeSummary } from '@/lib/home/summary'
import styles from './saved-tenjikai.module.css'

/** 保存条件の参照だけ。対象案件の復元や、準備進捗の表示ではない。 */
export default function SavedTenjikaiOverview({ tenjikai }: { tenjikai: HomeSummary['tenjikai'] }) {
  // 自発表示には保存条件の正常取得が必要。error/null自体はsummaryと明示agent回答に保持する。
  if (!tenjikai || tenjikai.state !== 'ready' || tenjikai.items.length === 0) return null
  return <section className={styles.card} aria-label="保存された出展条件">
    <div className={styles.header}><h2>保存された出展条件 <small>開発中</small></h2><Link href="/tenjikai">展示会を開く</Link></div>
    <p className={styles.note}>JSTの今日から60日以内に始まる出展条件を、会期順に最大20件表示しています。</p>
    <ul className={styles.list}>{tenjikai.items.map(project => <li key={project.key}>
      <h3>{project.projectName}</h3><p>{project.eventName}</p>
      <p><time dateTime={project.eventDate}>{project.eventDate}</time>（JST） / 会期初日まで{project.daysUntil}日</p>
    </li>)}</ul>
    <p className={styles.note}>保存された条件の表示です。生成や準備の完了を示すものではありません。</p>
    <p className={styles.note}>展示会の画面で、保存した案件を再表示する機能にはまだ対応していません。</p>
  </section>
}
