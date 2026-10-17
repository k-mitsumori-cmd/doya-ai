'use client'
// ============================================
// 共通シェル（全ツール共通の枠）
// ============================================
// 左にツール一覧（区分: 売る・集める・人・回す）、右に中身。
// - 1280px 以上: サイドバー展開
// - 768〜1279px: サイドバーはアイコンのみ
// - 767px 以下: 上にメニューボタン、下にタブバー（ホーム・最近使ったツール・すべて）。サイドバーは引き出し
// - ⌘K / Ctrl+K: 全ツール横断の検索
// ⚠️ 枠だけを担当する。中身のデータ取得・認可は各ページ側の責務。
// ⚠️ 公開画面・ゲスト画面（共有閲覧・面接・回答画面など）では使わない（ADDON R-7）。
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LayoutGrid, Menu, Search, X } from 'lucide-react'
import ds from '@/components/ds/tokens.module.css'
import { ShellIcon } from './icons'
import { ALL_SHELL_TOOLS, SHELL_GROUPS, SHELL_HOME, type ShellTool } from './tools'
import styles from './AppShell.module.css'

const RECENT_KEY = 'doya-shell-recent-v1'

function toolBase(tool: ShellTool) {
  return tool.href.split('/').slice(0, 2).join('/')
}

function isActive(pathname: string, tool: ShellTool) {
  const base = toolBase(tool)
  return pathname === tool.href || pathname === base || pathname.startsWith(`${base}/`)
}

function readRecent(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}

function NavItem({ tool, pathname, onNavigate }: { tool: ShellTool; pathname: string; onNavigate: () => void }) {
  const active = isActive(pathname, tool)
  return (
    <Link href={tool.href} className={styles.navItem} aria-current={active ? 'page' : undefined} onClick={onNavigate} title={tool.name}>
      <ShellIcon name={tool.icon} size={18} strokeWidth={2} />
      <span className={styles.navLabel}>{tool.name}</span>
      {tool.beta ? <span className={styles.beta}>開発中</span> : null}
    </Link>
  )
}

/* ---- ⌘K パレット ---- */
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (!k) return ALL_SHELL_TOOLS
    return ALL_SHELL_TOOLS.filter((t) => `${t.name} ${t.hint} ${t.id}`.toLowerCase().includes(k))
  }, [q])

  useEffect(() => {
    if (!open) return
    setQ('')
    setIndex(0)
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => setIndex(0), [q])

  if (!open) return null

  const go = (tool?: ShellTool) => {
    if (!tool) return
    onClose()
    router.push(tool.href)
  }

  return (
    <div className={styles.paletteScrim} onClick={onClose}>
      <div className={styles.palette} role="dialog" aria-modal="true" aria-label="ツールを探す" onClick={(e) => e.stopPropagation()}>
        <div className={styles.paletteInputRow}>
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(results.length - 1, i + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)) }
              if (e.key === 'Enter') { e.preventDefault(); go(results[index]) }
              if (e.key === 'Escape') onClose()
            }}
            placeholder="ツール名ややりたいことで探す"
            aria-label="ツールを探す"
            className={styles.paletteInput}
          />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>
        <ul className={styles.paletteList} role="listbox">
          {results.length ? results.map((t, i) => {
            return (
              <li key={t.id} role="option" aria-selected={i === index}>
                <button type="button" className={styles.paletteItem} data-active={i === index} onMouseEnter={() => setIndex(i)} onClick={() => go(t)}>
                  <span className={styles.paletteIcon}><ShellIcon name={t.icon} size={16} /></span>
                  <span className={styles.paletteText}><b>{t.name}</b><small>{t.hint}</small></span>
                  {t.beta ? <span className={styles.beta}>開発中</span> : null}
                </button>
              </li>
            )
          }) : <li className={styles.paletteEmpty}>見つかりませんでした</li>}
        </ul>
      </div>
    </div>
  )
}

export default function AppShell({ children, userName }: { children: ReactNode; userName?: string | null }) {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)
  const [palette, setPalette] = useState(false)
  const [recent, setRecent] = useState<string[]>([])

  // 最近使ったツール（タブバー用）。サービスを固定しない
  useEffect(() => {
    const current = ALL_SHELL_TOOLS.find((t) => t.id !== 'home' && isActive(pathname, t))
    const list = readRecent()
    const next = current ? [current.id, ...list.filter((id) => id !== current.id)].slice(0, 6) : list
    setRecent(next)
    if (current) {
      try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* 保存できなくても動く */ }
    }
  }, [pathname])

  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setPalette((v) => !v)
    }
    if (e.key === 'Escape') setOpen(false)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  const close = () => setOpen(false)

  const tabTools = useMemo(() => {
    const byId = new Map(ALL_SHELL_TOOLS.map((t) => [t.id, t]))
    const picked = recent.map((id) => byId.get(id)).filter((t): t is ShellTool => Boolean(t))
    const fill = SHELL_GROUPS.flatMap((g) => g.tools).filter((t) => !recent.includes(t.id))
    return [...picked, ...fill].slice(0, 3)
  }, [recent])

  return (
    <div className={`${ds.ds} ${styles.shell}`}>
      <a href="#shell-main" className={styles.skip}>本文へ移動</a>
      <header className={styles.topbar}>
        <button type="button" className={styles.iconButton} onClick={() => setOpen(true)} aria-label="メニューを開く">
          <Menu size={20} />
        </button>
        <Link href={SHELL_HOME.href} className={styles.brand}>
          <span className={styles.brandMark} aria-hidden />ドヤAI
        </Link>
        <button type="button" className={styles.iconButton} onClick={() => setPalette(true)} aria-label="ツールを探す">
          <Search size={18} />
        </button>
      </header>

      <div className={styles.scrim} data-open={open} onClick={close} aria-hidden />

      <nav className={styles.sidebar} data-open={open} aria-label="ツール一覧">
        <div className={styles.sideHead}>
          <Link href={SHELL_HOME.href} className={styles.brand} onClick={close}>
            <span className={styles.brandMark} aria-hidden />
            <span className={styles.navLabel}>ドヤAI</span>
          </Link>
          <button type="button" className={`${styles.iconButton} ${styles.closeButton}`} onClick={close} aria-label="メニューを閉じる">
            <X size={18} />
          </button>
        </div>
        <button type="button" className={styles.search} onClick={() => setPalette(true)} title="ツールを探す">
          <Search size={16} aria-hidden />
          <span className={styles.navLabel}>ツールを探す</span>
          <kbd className={`${styles.kbd} ${styles.navLabel}`}>⌘K</kbd>
        </button>
        <div className={styles.navScroll}>
          <NavItem tool={SHELL_HOME} pathname={pathname} onNavigate={close} />
          {SHELL_GROUPS.map((group) => (
            <div key={group.stage} className={styles.group}>
              <p className={styles.groupLabel}>{group.label}</p>
              {group.tools.map((tool) => (
                <NavItem key={tool.id} tool={tool} pathname={pathname} onNavigate={close} />
              ))}
            </div>
          ))}
        </div>
        {userName ? <p className={styles.userLine}>{userName} さん</p> : null}
      </nav>

      <main id="shell-main" className={styles.main}>{children}</main>

      <nav className={styles.tabbar} aria-label="よく使うツール">
        {[SHELL_HOME, ...tabTools].map((t) => {
          return (
            <Link key={t.id} href={t.href} className={styles.tab} aria-current={isActive(pathname, t) ? 'page' : undefined}>
              <ShellIcon name={t.icon} size={20} />
              <span>{t.id === 'home' ? 'ホーム' : t.name}</span>
            </Link>
          )
        })}
        <button type="button" className={styles.tab} onClick={() => setOpen(true)}>
          <LayoutGrid size={20} aria-hidden />
          <span>すべて</span>
        </button>
      </nav>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}
