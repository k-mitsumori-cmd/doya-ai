'use client'
// ============================================
// 共通シェル（全ツール共通の枠）
// ============================================
// 左にツール一覧、右に中身。スマホではメニューボタンで開く引き出しになる。
// ⚠️ 枠だけを担当する。中身のデータ取得・認可は各ページ側の責務。
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import { SHELL_GROUPS, SHELL_HOME, type ShellTool } from './tools'
import styles from './AppShell.module.css'

function isActive(pathname: string, tool: ShellTool) {
  const base = tool.href.split('/').slice(0, 2).join('/')
  return pathname === tool.href || pathname.startsWith(`${base}/`) || pathname === base
}

function NavItem({ tool, pathname, onNavigate }: { tool: ShellTool; pathname: string; onNavigate: () => void }) {
  const Icon = tool.icon
  const active = isActive(pathname, tool)
  return (
    <Link href={tool.href} className={styles.navItem} aria-current={active ? 'page' : undefined} onClick={onNavigate} title={tool.hint}>
      <Icon size={17} strokeWidth={2} aria-hidden />
      <span>{tool.name}</span>
    </Link>
  )
}

export default function AppShell({ children, userName }: { children: ReactNode; userName?: string | null }) {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => setOpen(false)

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <button type="button" className={styles.menuButton} onClick={() => setOpen(true)} aria-label="メニューを開く">
          <Menu size={20} />
        </button>
        <Link href="/home" className={styles.brand}>ドヤAI</Link>
      </header>

      <div className={styles.scrim} data-open={open} onClick={close} aria-hidden />

      <nav className={styles.sidebar} data-open={open} aria-label="ツール一覧">
        <div className={styles.sideHead}>
          <Link href="/home" className={styles.brand} onClick={close}>
            <span className={styles.brandMark} aria-hidden />
            ドヤAI
          </Link>
          <button type="button" className={styles.closeButton} onClick={close} aria-label="メニューを閉じる">
            <X size={18} />
          </button>
        </div>
        <div className={styles.navScroll}>
          <NavItem tool={SHELL_HOME} pathname={pathname} onNavigate={close} />
          {SHELL_GROUPS.map((group) => (
            <div key={group.label} className={styles.group}>
              <p className={styles.groupLabel}>{group.label}</p>
              {group.tools.map((tool) => (
                <NavItem key={tool.id} tool={tool} pathname={pathname} onNavigate={close} />
              ))}
            </div>
          ))}
        </div>
        {userName ? <p className={styles.userLine}>{userName} さん</p> : null}
      </nav>

      <main className={styles.main}>{children}</main>
    </div>
  )
}
