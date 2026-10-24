'use client'
// ============================================
// 共通シェル（全ツール共通の枠）
// ============================================
// 左にツール一覧（区分: マーケティング・営業（セールス）・採用・人材管理・経理・バックオフィス）、右に中身。
// - 1280px 以上: サイドバー展開
// - 768〜1279px: サイドバーはアイコンのみ
// - 767px 以下: 上にメニューボタン、下にタブバー（ホーム・最近使ったツール・すべて）。サイドバーは引き出し
// - ⌘K / Ctrl+K: 全ツール横断の検索
// ⚠️ 枠だけを担当する。中身のデータ取得・認可は各ページ側の責務。
// ⚠️ 公開画面・ゲスト画面（共有閲覧・面接・回答画面など）では使わない（ADDON R-7）。
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleUser, CreditCard, LayoutGrid, LogOut, Menu, Search, Sparkles, X } from 'lucide-react'
import { HOME_INTENT_GROUPS } from '@/app/(shell)/home/intents'
import { signOut } from 'next-auth/react'
import ds from '@/components/ds/tokens.module.css'
import { ShellIcon } from './icons'
import { ShellUsageProvider } from './ShellUsage'
import { InShellContext } from './in-shell'
import { ALL_SHELL_TOOLS, SHELL_HOME, SHELL_GROUPS, type ShellTool } from './tools'
import { useToolHref } from './ui-next-context'
import ShellCompanyCard from './ShellCompanyCard'
import { demoteExtraH1 } from './heading-guard'
import { RECENT_COOKIE, serializeRecent } from '@/lib/shell/recent'
import styles from './AppShell.module.css'
import { ShellPowerMeter } from './power'
import { DoyaLogoMark } from '@/components/brand/DoyaLogo'

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

function NavItem({ tool, pathname, onNavigate, prefetch, mirror }: { tool: ShellTool; pathname: string; onNavigate: (href: string) => void; prefetch?: boolean; mirror?: boolean }) {
  const active = isActive(pathname, tool)
  // 組織を選ぶツールは、入口ではなく組織のページへ（中身がある）
  const href = useToolHref()(tool.href)
  // mirror は「最近使ったツール」の複製。今のページの印（aria-current）は本来の区分の側だけに付ける
  return (
    <Link href={href} className={styles.navItem} aria-current={active && !mirror ? 'page' : undefined} data-active={active && mirror ? 'true' : undefined} onClick={() => onNavigate(href)} title={tool.name} prefetch={prefetch}>
      <ShellIcon name={tool.icon} size={18} strokeWidth={2} />
      <span className={styles.navLabel}>{tool.name}</span>
      {tool.beta ? <span className={styles.beta}>開発中</span> : null}
    </Link>
  )
}

/* ---- ⌘K パレット ---- */
/** ⌘K の候補。ツールのほか、新しい見た目では「やりたいこと」も探せる（経営ホームの入力と同じ辞書。UI 品質 S-5） */
type PaletteItem = { key: string; name: string; hint: string; href: string; icon?: ShellTool['icon']; beta?: boolean; intent?: boolean }
const TOOL_ITEMS: PaletteItem[] = ALL_SHELL_TOOLS.map((t) => ({ key: t.id, name: t.name, hint: t.hint, href: t.href, icon: t.icon, beta: t.beta }))
const INTENT_ITEMS: (PaletteItem & { words: string })[] = HOME_INTENT_GROUPS.flatMap((g) => g.intents.map((i) => ({
  key: `intent:${i.label}`, name: i.label, hint: g.label, href: i.href, intent: true, words: `${i.label} ${i.keywords.join(' ')}`.toLowerCase(),
})))

function CommandPalette({ open, onClose, withIntents }: { open: boolean; onClose: () => void; withIntents: boolean }) {
  const router = useRouter()
  const toHref = useToolHref()
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo<PaletteItem[]>(() => {
    const k = q.trim().toLowerCase()
    if (!k) return TOOL_ITEMS
    const tools = TOOL_ITEMS.filter((t) => `${t.name} ${t.hint} ${t.key}`.toLowerCase().includes(k))
    if (!withIntents) return tools
    const compact = k.replace(/\s+/g, '')
    const intents = INTENT_ITEMS.filter((i) => i.words.includes(k) || i.words.replace(/\s+/g, '').includes(compact) || i.words.split(' ').some((w) => w && compact.includes(w)))
    return [...intents, ...tools]
  }, [q, withIntents])

  useEffect(() => {
    if (!open) return
    setQ('')
    setIndex(0)
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => setIndex(0), [q])

  if (!open) return null

  const go = (item?: PaletteItem) => {
    if (!item) return
    onClose()
    router.push(toHref(item.href))
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
              <li key={t.key} role="option" aria-selected={i === index}>
                <button type="button" className={styles.paletteItem} data-active={i === index} onMouseEnter={() => setIndex(i)} onClick={() => go(t)}>
                  <span className={styles.paletteIcon}>{t.intent ? <Sparkles size={16} aria-hidden /> : <ShellIcon name={t.icon ?? 'LayoutGrid'} size={16} />}</span>
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

/** HubSpot のポップアップの要素（CompanyDialog.tsx で会社情報の画面を開いている間に隠すものと同じ） */
const HIDE_HUBSPOT_CSS = '[id^="hs-web-interactives"],[class*="hs-web-interactive"],#hubspot-messages-iframe-container,.hs-overlay-container{display:none!important}'

export default function AppShell({ children, userName, initialRecent }: {
  children: ReactNode
  userName?: string | null
  /** 最近使ったツール（新しい見た目のとき、サーバーが cookie から読んで渡す。最初の描画から並べ、あとから押し下げない） */
  initialRecent?: string[]
}) {
  const pathname = usePathname() || '/'
  // 新しい見た目（チェックリスト §5.1）のときだけ、UI 品質の直し（区分の名前・押した瞬間の選択・先読み）を使う
  const toHref = useToolHref()
  const groups = SHELL_GROUPS
  const [open, setOpen] = useState(false)
  const [palette, setPalette] = useState(false)
  const [recent, setRecent] = useState<string[]>(initialRecent ?? [])
  // サーバーから並びを受け取ったときは、最初の1回は表示を変えない（読み込みの直後に並びが動くと CLS になる）
  const keepFirst = useRef(Boolean(initialRecent))

  // 最近使ったツール（タブバー用）。サービスを固定しない
  useEffect(() => {
    const current = ALL_SHELL_TOOLS.find((t) => t.id !== 'home' && isActive(pathname, t))
    const list = readRecent()
    const next = current ? [current.id, ...list.filter((id) => id !== current.id)].slice(0, 6) : list
    if (keepFirst.current) keepFirst.current = false
    else setRecent(next)
    try { document.cookie = `${RECENT_COOKIE}=${serializeRecent(next)}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax` } catch { /* 覚えられなくても動く */ }
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
  // 押した瞬間に選択の表示を変える（読み込みを待たない。UI 品質 C-5）。移り終わったら実際のパスに戻す
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  useEffect(() => setPendingHref(null), [pathname])
  const shownPath = pendingHref ?? pathname
  const navigate = (href: string) => { setPendingHref(href); close() }
  const prefetch = true

  const tabTools = useMemo(() => {
    const byId = new Map(ALL_SHELL_TOOLS.map((t) => [t.id, t]))
    const picked = recent.map((id) => byId.get(id)).filter((t): t is ShellTool => Boolean(t))
    const fill = groups.flatMap((g) => g.tools).filter((t) => !recent.includes(t.id))
    // 新しい見た目のスマホの下のタブは「ホーム・最近使ったツール2つ・すべて・アカウント」の決まった並び（UI 品質 S-4）
    return [...picked, ...fill].slice(0, 2)
  }, [recent, groups])

  // 左のメニューの上に出す「最近使ったツール」（UI 品質 S-1）
  const recentTools = useMemo(() => {
    const byId = new Map(ALL_SHELL_TOOLS.map((t) => [t.id, t]))
    return recent.map((id) => byId.get(id)).filter((t): t is ShellTool => Boolean(t) && t!.id !== 'home').slice(0, 3)
  }, [recent])

  // 枠の中の h1 を1つにする（UI 品質 S-57）
  const mainRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = mainRef.current
    if (!el || typeof MutationObserver === 'undefined') return
    demoteExtraH1(el)
    const mo = new MutationObserver(() => demoteExtraH1(el))
    mo.observe(el, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])

  const openAccount = () => {
    setOpen(true)
    requestAnimationFrame(() => document.getElementById('shell-account')?.scrollIntoView({ block: 'end' }))
  }

  return (
    <InShellContext.Provider value={true}>
    <ShellUsageProvider>
    <div className={`${ds.ds} ${styles.shell}`} data-ui-next="true">
      {/* 枠の中のアプリの画面では、HubSpot のポップアップ（GTM のカスタム HTML タグから出る）を出さない。
          375px で画面の下と下のタブを覆うため。ログインしていない人の LP（枠の外）には、この style は出ないので今のまま出る */}
      <style>{HIDE_HUBSPOT_CSS}</style>
      <a href="#shell-main" className={styles.skip}>本文へ移動</a>
      <header className={styles.topbar}>
        <button type="button" className={styles.iconButton} onClick={() => setOpen(true)} aria-label="メニューを開く">
          <Menu size={20} />
        </button>
        <Link href={SHELL_HOME.href} className={styles.brand}>
          <DoyaLogoMark size={28} className={styles.brandMark} />ドヤAI
        </Link>
        {/* ドヤパワーの残り（旗が出すと決め、残りの値があるときだけ。無ければ何も描かない） */}
        <ShellPowerMeter variant="topbar" />
        <button type="button" className={styles.iconButton} onClick={() => setPalette(true)} aria-label="ツールを探す">
          <Search size={18} />
        </button>
      </header>

      <div className={styles.scrim} data-open={open} onClick={close} aria-hidden />

      <nav className={styles.sidebar} data-open={open} aria-label="ツール一覧">
        <div className={styles.sideHead}>
          <Link href={SHELL_HOME.href} className={styles.brand} onClick={close}>
            <DoyaLogoMark size={28} className={styles.brandMark} />
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
        {/* 新しい見た目では、ドヤパワーの残りは左下（会社の下）に出す。今の見た目はここ */}
        <div className={styles.navScroll}>
          <NavItem tool={SHELL_HOME} pathname={shownPath} onNavigate={navigate} prefetch={prefetch} />
          {recentTools.length ? (
            <div className={styles.group}>
              <p className={styles.groupLabel}>最近使ったツール</p>
              {recentTools.map((tool) => (
                <NavItem key={tool.id} tool={tool} pathname={shownPath} onNavigate={navigate} prefetch={prefetch} mirror />
              ))}
            </div>
          ) : null}
          {groups.map((group) => (
            <div key={group.stage} className={styles.group}>
              <p className={styles.groupLabel}>{group.label}</p>
              {group.tools.map((tool) => (
                <NavItem key={tool.id} tool={tool} pathname={shownPath} onNavigate={navigate} prefetch={prefetch} />
              ))}
            </div>
          ))}
        </div>
        {/* 新しい見た目では、左下はどの画面でも同じもの（登録会社・ドヤパワー・アカウント・ログアウト）だけにする。
            ツールごとの「作った数 / 残り」は、ツールの見出しの帯（ToolFrame）に出す（2026-10-24 ユーザーの指摘「ツールを押すごとに変わるのは分かりにくい」） */}
        <div className={styles.account} id="shell-account">
          {/* 登録会社と切り替え（中身が出る。UI 品質 B-1） */}
          <ShellCompanyCard />
          <ShellPowerMeter variant="sidebar" />
          {userName ? <p className={styles.userLine}>{userName} さん</p> : null}
          <Link href="/pricing" className={styles.navItem} onClick={close} title="料金プラン">
            <CreditCard size={18} strokeWidth={2} aria-hidden />
            <span className={styles.navLabel}>料金プラン</span>
          </Link>
          <button type="button" className={`${styles.navItem} ${styles.logout}`} onClick={() => signOut({ callbackUrl: '/' })} title="ログアウト">
            <LogOut size={18} strokeWidth={2} aria-hidden />
            <span className={styles.navLabel}>ログアウト</span>
          </button>
        </div>
      </nav>

      <main id="shell-main" ref={mainRef} className={styles.main}>
        {/* 読み込みの表示は、枠の上の細い線だけ（UI 品質 C-3）。
            ⚠️ loading.tsx は置かない。置くと、ふつうの利用者にも前のページが消えて読み込みが出るようになる */}
        {pendingHref && pendingHref !== pathname ? <div className={styles.progress} role="progressbar" aria-label="読み込み中" /> : null}
        {children}
      </main>

      <nav className={styles.tabbar} aria-label="よく使うツール">
        {[SHELL_HOME, ...tabTools].map((t) => {
          return (
            <Link key={t.id} href={toHref(t.href)} className={styles.tab} aria-current={isActive(pathname, t) ? 'page' : undefined}>
              <ShellIcon name={t.icon} size={20} />
              <span>{t.id === 'home' ? 'ホーム' : t.name}</span>
            </Link>
          )
        })}
        <button type="button" className={styles.tab} onClick={() => setOpen(true)}>
          <LayoutGrid size={20} aria-hidden />
          <span>すべて</span>
        </button>
        <button type="button" className={styles.tab} onClick={openAccount}>
            <CircleUser size={20} aria-hidden />
            <span>アカウント</span>
          </button>
      </nav>

      <CommandPalette open={palette} onClose={() => setPalette(false)} withIntents={true} />
    </div>
    </ShellUsageProvider>
    </InShellContext.Provider>
  )
}
