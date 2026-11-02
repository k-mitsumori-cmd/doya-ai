'use client'
// ============================================
// 製品のホームの画面（/hub/<id>）
// ============================================
// 上から: 製品の名前 → ドヤくんに頼む → 今月の数字 → 製品のツール → ほかの製品。
// ⚠️ 数字はサーバーが経営ホームの集計から選んで渡す（作り物は出さない）。読めないときは「まだデータがありません」とツールを開くボタン。
// ⚠️ ツールのリンクは、組織を選ぶツールなら組織のページへ（useToolHref）。
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { PRODUCTS, getProduct, type ProductId } from '@/lib/products'
import type { HubMetric } from '@/lib/products/hub-metrics'
import { brandName } from '@/lib/brand'
import { productShellTools } from '@/components/shell/tools'
import { ToolBearIcon } from '@/components/shell/ToolBearIcon'
import { ShellIcon } from '@/components/shell/icons'
import { useToolHref } from '@/components/shell/ui-next-context'
import styles from './hub.module.css'

export default function HubView({ productId, metrics, metricsUnavailable = false, agentStage = null }: {
  productId: ProductId
  metrics: HubMetric[]
  /** 集計そのものが読めなかった */
  metricsUnavailable?: boolean
  agentStage?: ReactNode
}) {
  const product = getProduct(productId)
  const tools = productShellTools(productId)
  const toHref = useToolHref()
  const others = PRODUCTS.filter((p) => p.id !== productId)

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden><ShellIcon name={product.icon} size={22} strokeWidth={2} /></span>
        <div className={styles.headText}>
          <p className={styles.eyebrow}>{brandName()}</p>
          <h1 className={styles.title}>{product.name}</h1>
          <p className={styles.lead}>{product.hint}を、ここからまとめて進めます。</p>
        </div>
      </header>

      {agentStage ? <section className={styles.agent} aria-label="ドヤくんに頼む">{agentStage}</section> : null}

      {metrics.length || metricsUnavailable ? (
        <section className={styles.section} aria-labelledby="hub-metrics">
          <h2 id="hub-metrics" className={styles.sectionTitle}>今月の数字</h2>
          {metricsUnavailable ? (
            <p className={styles.empty}>数字を読み込めませんでした。時間をおいて開き直してください。</p>
          ) : (
            <div className={styles.metrics}>
              {metrics.map((m) => (
                <Link key={m.key} href={toHref(m.href)} className={styles.metric} prefetch={false}>
                  <span className={styles.metricLabel}>{m.label}</span>
                  {m.state === 'ready' ? (
                    <>
                      <span className={styles.metricValue}>{m.value}</span>
                      {m.sub ? <span className={styles.metricSub}>{m.sub}</span> : null}
                    </>
                  ) : (
                    <>
                      <span className={styles.metricEmpty}>{m.state === 'error' ? '読み込めませんでした' : 'まだデータがありません'}</span>
                      <span className={styles.metricOpen}>ツールを開く<ArrowRight size={14} aria-hidden /></span>
                    </>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="hub-tools">
        <h2 id="hub-tools" className={styles.sectionTitle}>{product.name}のツール</h2>
        <ul className={styles.tools}>
          {tools.map((t) => (
            <li key={t.id}>
              <Link href={toHref(t.href)} className={styles.tool}>
                <ToolBearIcon id={t.id} icon={t.icon} size={44} iconSize={22} />
                <span className={styles.toolText}>
                  <b>{t.name}{t.beta ? <span className={styles.beta}>開発中</span> : null}</b>
                  <small>{t.lead ?? t.hint}</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="hub-others">
        <h2 id="hub-others" className={styles.sectionTitle}>ほかの製品</h2>
        <p className={styles.note}>契約はプロ1つで、どの製品のツールも使えます。</p>
        <nav className={styles.others} aria-labelledby="hub-others">
          {others.map((p) => (
            <Link key={p.id} href={p.home} className={styles.other} prefetch={false}>
              <ShellIcon name={p.icon} size={16} strokeWidth={2} />
              {p.name}
            </Link>
          ))}
        </nav>
      </section>
    </div>
  )
}
