'use client'
// ============================================
// 経営ホームのドヤパワーの欄（#doya-power）と、内訳・履歴の画面（/home/doya-power）
// ============================================
// 値はサーバー（src/lib/doya-power/home.server.ts）が決めて props で渡す。ここで台帳や API を読まない。
// ⚠️ 旗（DOYA_POWER_ROLLOUT）が出さないと決めた人には、ページの側で渡さない（null なら何も描かない）。
// ⚠️ ドヤくんの絵と演出は、枠の DoyaPowerFxProvider の設定に従う（DoyaPowerGauge が見る）。
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DoyaPowerGauge } from './DoyaPower'
import DoyaPowerFxSettings from './DoyaPowerFxSettings'
import { saveDoyaPowerFx } from '@/lib/doya-power/fx-actions'
import { jstDateTime } from './time'
import { KIND_LABELS } from '@/lib/doya-power/history-label'
import { GRANT_KINDS } from '@/lib/doya-power/rules'
import { whatYouCanDo } from '@/lib/doya-power/costs'
import { usageBreakdown } from '@/lib/doya-power/breakdown'
import type { DoyaPowerHomeView } from '@/lib/doya-power/home.server'
import styles from './DoyaPowerHome.module.css'

const fmt = (n: number) => Math.max(0, Math.round(n)).toLocaleString('ja-JP')

function ExpiryNote({ view }: { view: DoyaPowerHomeView }) {
  if (!view.nextExpiry || view.nextExpiry.amount <= 0) return null
  return <p className={styles.note}>{jstDateTime(view.nextExpiry.at)}（日本時間）に、{fmt(view.nextExpiry.amount)} が期限切れになります。</p>
}

/** 経営ホームの欄。左のメニュー・上の帯の残りのゲージから、ここ（/home#doya-power）と内訳・履歴の画面へ来る */
export function DoyaPowerHomeCard({ view }: { view: DoyaPowerHomeView | null }) {
  if (!view) return null
  return (
    <section id="doya-power" className={styles.card} aria-labelledby="home-doya-power">
      <div className={styles.head}>
        <h2 id="home-doya-power" className={styles.title}>ドヤパワー</h2>
      </div>
      <DoyaPowerGauge remaining={view.remaining} limit={view.limit} nextRecoveryAt={view.nextRecoveryAt ?? undefined} />
      <ExpiryNote view={view} />
      <ul className={styles.links}>
        <li><Link href="/home/doya-power" className={`${styles.link} ${styles.primary}`}>内訳と履歴を見る</Link></li>
        <li><Link href="/home/missions" className={styles.link}>ミッション</Link></li>
        <li><Link href="/home/collection" className={styles.link}>ツール図鑑</Link></li>
        <li><Link href="/home/annual" className={styles.link}>年間レポート</Link></li>
      </ul>
    </section>
  )
}

/** 内訳・履歴の画面の中身 */
export function DoyaPowerDetail({ view, canEditOrg = false }: { view: DoyaPowerHomeView; canEditOrg?: boolean }) {
  const router = useRouter()
  const usage = usageBreakdown(view.history)
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>ドヤパワー</p>
          <h2 className={styles.pageTitle}>内訳と履歴</h2>
          <p className={styles.subtitle}>今の残りの内訳と、増えた・減った記録です。生成に失敗したときは、減った分が戻ります。</p>
        </div>
        <Link href="/home#doya-power" className={styles.link}>経営ホームに戻る</Link>
      </header>
      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="dp-balance">
          <h3 id="dp-balance" className={styles.title}>今の残り</h3>
          <DoyaPowerGauge remaining={view.remaining} limit={view.limit} nextRecoveryAt={view.nextRecoveryAt ?? undefined} />
          <ExpiryNote view={view} />
          <p className={styles.canDo}>
            あと{' '}
            {whatYouCanDo(view.remaining).slice(0, 4).map((w, i) => (
              <span key={w.label} className={styles.canDoItem}>{i > 0 ? '・' : ''}{w.label}{fmt(w.count)}{w.unit}</span>
            ))}
            {' '}できます。
          </p>
          <ul className={styles.kinds} aria-label="残りの内訳">
            {GRANT_KINDS.map((k) => (
              <li key={k} className={styles.kind}><span>{KIND_LABELS[k]}</span><span className={styles.num}>{fmt(view.byKind[k] ?? 0)}</span></li>
            ))}
          </ul>
        </section>
        <section className={styles.card} aria-labelledby="dp-history">
          <h3 id="dp-history" className={styles.title}>履歴（新しい順・{view.history.length}件）</h3>
          {view.history.length === 0 ? (
            <div className={styles.emptyBox}>
              <img src="/empty/zero.svg" alt="" width={160} height={128} className={styles.emptyImg} />
              <p className={styles.empty}>まだ記録がありません。ツールで作ると、ここに使った量が並びます。</p>
            </div>
          ) : (
            <ul className={styles.rows}>
              {view.history.map((h, i) => (
                <li key={`${h.at}-${i}`} className={styles.row}>
                  <span className={styles.when}>{jstDateTime(h.at)}</span>
                  <span className={styles.what}>{h.label}</span>
                  <span className={styles.delta} data-sign={h.amount > 0 ? 'plus' : 'minus'}>
                    {h.amount > 0 ? '+' : '−'}{fmt(Math.abs(h.amount))}
                    <span className={styles.after}>残り {fmt(h.balanceAfter)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {view.history.length > 0 && view.history.length < 6 ? (
            <div className={styles.usage}>
              <h4 className={styles.usageTitle}>今月の使い道の内訳</h4>
              {usage.length === 0 ? (
                <p className={styles.empty}>今月はまだ使っていません。</p>
              ) : (
                <ul className={styles.kinds} aria-label="今月の使い道の内訳">
                  {usage.map((u) => (
                    <li key={u.label} className={styles.kind}><span>{u.label}（{u.count}回）</span><span className={styles.num}>−{fmt(u.total)}</span></li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>
      </div>
      <section id="display-settings" className={styles.card} aria-labelledby="dp-display">
        <h3 id="dp-display" className={styles.title}>表示の設定</h3>
        <DoyaPowerFxSettings
          canEditOrg={canEditOrg}
          onSave={async (scope, setting) => {
            const r = await saveDoyaPowerFx(scope, setting)
            if (r.ok) router.refresh()
            return r
          }}
        />
      </section>
    </div>
  )
}
