'use client'

import Link from 'next/link'
import type { HomeSummary } from '@/lib/home/summary'
import styles from './popup-overview.module.css'

/** ホームの同一 snapshot を表示する。UI 側では再集計・別 read を行わない。 */
export default function PopupOverview({ popup }: { popup: HomeSummary['popup'] }) {
  if (!popup || (popup.state === 'ready' && popup.value.siteCount === 0)) return null
  const value = popup.state === 'ready' ? popup.value : null
  return <section className={styles.card} aria-label="集客の数字（7日）">
    <div className={styles.header}><h2>集客の数字（7日）</h2><Link href="/popup">ポップアップを開く</Link></div>
    <p className={styles.note}>ポップアップ / 今日を含む直近7日 / JST</p>
    {value ? <dl className={styles.metrics}>
      <div><dt>表示回数</dt><dd>{value.totals.impressions.toLocaleString('ja-JP')}</dd></div>
      <div><dt>クリック数</dt><dd>{value.totals.clicks.toLocaleString('ja-JP')}</dd></div>
      <div><dt>クリック率</dt><dd>{value.totals.ctr === null ? '—' : `${value.totals.ctr.toLocaleString('ja-JP')}%`}</dd></div>
    </dl> : <p role="status" className={styles.note}>取得できませんでした。ホームの更新ボタンから再取得してください。</p>}
    {value && value.totals.ctr === null ? <p className={styles.note}>表示が0回のため、クリック率は未算定です。</p> : null}
  </section>
}
