'use client'
// ============================================
// ToolFrame — ツール画面の枠（AppShell の中身側）
// ============================================
// パンくず（経営ホーム / ツール名）・見出し・主ボタン 1 つ・ツール内ナビ（タブ）・右ペイン（1280px 以上）。
// ⚠️ 各ツールの既存ページをそのまま children に入れられるようにする（page.tsx は触らない。README §18.6 手順 1）。
// ⚠️ ナビは src/lib/<svc>/nav.ts のデータを渡す（ADDON R-1）。
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { ALL_SHELL_TOOLS, SHELL_HOME } from './tools'
import { isNavActive, type ShellNavItem } from './nav'
import styles from './ToolFrame.module.css'

export default function ToolFrame({ serviceId, title, description, action, nav, aside, children }: {
  serviceId: string
  /** 見出し。省略時はツール名 */
  title?: ReactNode
  description?: ReactNode
  /** 主ボタン（1 画面 1 つ） */
  action?: ReactNode
  nav?: ShellNavItem[]
  /** 右ペイン（1280px 以上でのみ表示） */
  aside?: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname() || '/'
  const tool = ALL_SHELL_TOOLS.find((t) => t.id === serviceId)
  const name = tool?.name ?? serviceId

  return (
    <div className={styles.frame}>
      <div className={styles.head}>
        <nav className={styles.crumbs} aria-label="パンくず">
          <Link href={SHELL_HOME.href}>{SHELL_HOME.name}</Link>
          <ChevronRight size={14} aria-hidden />
          <span aria-current="page">{name}</span>
        </nav>
        <div className={styles.titleRow}>
          <div className={styles.titleBox}>
            <h1 className={styles.title}>{title ?? name}</h1>
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {action ? <div className={styles.action}>{action}</div> : null}
        </div>
        {nav?.length ? (
          <div className={styles.tabs} role="tablist" aria-label={`${name}のメニュー`}>
            {nav.map((item) => {
              const Icon = item.icon
              const active = isNavActive(pathname, item)
              return (
                <Link key={item.href} href={item.href} className={styles.tab} role="tab" aria-selected={active} aria-current={active ? 'page' : undefined}>
                  {Icon ? <Icon size={16} aria-hidden /> : null}
                  {item.label}
                </Link>
              )
            })}
          </div>
        ) : null}
      </div>
      <div className={styles.body} data-aside={aside ? 'true' : undefined}>
        <div className={styles.content}>{children}</div>
        {aside ? <aside className={styles.aside}>{aside}</aside> : null}
      </div>
    </div>
  )
}
