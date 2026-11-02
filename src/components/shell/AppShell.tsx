'use client'
// ============================================
// 共通シェル（全ツール共通の枠）
// ============================================
// 左に経営ホーム・動いているタスク・ツール一覧（部署のまとまり: ドヤマーケAI・ドヤセールスAI・ドヤ人事AI・ドヤ管理AI。見出しで開閉）、右に中身。
// - 1280px 以上: サイドバー展開
// - 768〜1279px: サイドバーはアイコンのみ
// - 767px 以下: 上にメニューボタン、下にタブバー（ホーム・最近使ったツール・すべて）。サイドバーは引き出し
// - ⌘K / Ctrl+K: 全ツール横断の検索
// ⚠️ 枠だけを担当する。中身のデータ取得・認可は各ページ側の責務。
// ⚠️ 公開画面・ゲスト画面（共有閲覧・面接・回答画面など）では使わない（ADDON R-7）。
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bell, ChevronDown, CircleUser, CreditCard, LayoutGrid, ListTodo, LogOut, Menu, Search, Sparkles, X } from 'lucide-react'
import { HOME_INTENT_GROUPS } from '@/app/(shell)/home/intents'
import { signOut } from 'next-auth/react'
import ds from '@/components/ds/tokens.module.css'
import { ShellIcon, type ShellIconName } from './icons'
import { ToolBearIcon } from './ToolBearIcon'
import { ShellUsageProvider } from './ShellUsage'
import { InShellContext } from './in-shell'
import { ALL_SHELL_TOOLS, SHELL_HOME, SHELL_GROUPS, buildDepartmentGroups, buildProductGroups, productShellTools, type ShellTool } from './tools'
import { departmentOfTool, getDepartment, type DepartmentId } from '@/lib/departments'
import { PRODUCTS, PRODUCT_COOKIE, getProduct, productForPath, productsOfTool, type ProductId } from '@/lib/products'
import ProductSwitcher from './ProductSwitcher'
import { useToolHref } from './ui-next-context'
import ShellCompanyCard from './ShellCompanyCard'
import { demoteExtraH1 } from './heading-guard'
import { RECENT_COOKIE, serializeRecent } from '@/lib/shell/recent'
import { NAV_GROUPS_COOKIE, serializeNavGroups } from '@/lib/shell/nav-groups'
import { useNotice } from '@/components/notice/NoticeProvider'
import { newToolIds } from '@/lib/notice/announcements'

// 日付で変わるので、開くたびに作る（同じ描画の中では1回だけ）
let newToolCache: { day: string; ids: Set<string> } | null = null
function NEW_TOOL_IDS(): Set<string> {
  const day = new Date().toDateString()
  if (!newToolCache || newToolCache.day !== day) newToolCache = { day, ids: newToolIds(new Date()) }
  return newToolCache.ids
}
import styles from './AppShell.module.css'
import { ShellPowerMeter } from './power'
import { DoyaLogoMark } from '@/components/brand/DoyaLogo'
// 名前（旗 NEXT_PUBLIC_BRAND_RENAME_ROLLOUT が all ならドヤバディ、それ以外はドヤAI）
import { brandName } from '@/lib/brand'

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
  // 「新機能」の札（提案リスト (11)）。ドヤくんの知らせの旗が出すと決めた人だけ。載せた日から7日で消える
  const notice = useNotice()
  const isNew = notice.enabled && NEW_TOOL_IDS().has(tool.id)
  // 組織を選ぶツールは、入口ではなく組織のページへ（中身がある）
  const href = useToolHref()(tool.href)
  // mirror は「最近使ったツール」の複製。今のページの印（aria-current）は本来の区分の側だけに付ける
  return (
    <Link href={href} className={styles.navItem} aria-current={active && !mirror ? 'page' : undefined} data-active={active && mirror ? 'true' : undefined} onClick={() => onNavigate(href)} title={tool.name} prefetch={prefetch}>
      <ToolBearIcon id={tool.id} icon={tool.icon} />
      <span className={styles.navLabel}>{tool.name}</span>
      {tool.beta ? <span className={styles.beta}>開発中</span> : null}
      {!tool.beta && isNew ? <span className={styles.newTag}>新機能</span> : null}
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

/** 製品のホーム（旗 PRODUCT_HUBS_ROLLOUT が on のとき、⌘K で製品の名前からも開ける） */
const PRODUCT_ITEMS: (PaletteItem & { words: string })[] = PRODUCTS.map((p) => ({
  key: `product:${p.id}`, name: `${p.name}のホーム`, hint: p.hint, href: p.home, icon: p.icon, words: `${p.name} ${p.en} ${p.id}`.toLowerCase(),
}))

function CommandPalette({ open, onClose, withIntents, withDepartments = false, withProducts = false }: { open: boolean; onClose: () => void; withIntents: boolean; withDepartments?: boolean; withProducts?: boolean }) {
  const router = useRouter()
  const toHref = useToolHref()
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo<PaletteItem[]>(() => {
    const k = q.trim().toLowerCase()
    if (!k) return TOOL_ITEMS
    // 部署の旗が on のときは、部署の名前（「セールス」「ドヤ人事AI」など）でもツールを探せる
    const deptWords = (key: string) => {
      if (!withDepartments) return ''
      const id = departmentOfTool(key)
      if (!id) return ''
      const d = getDepartment(id)
      return ` ${d.name} ${d.short}`
    }
    // 製品の旗が on のときは、製品の名前（「セールス」「予実管理」など）でも、製品のホームとツールを探せる
    const productWords = (key: string) => (withProducts ? productsOfTool(key).map((id) => ` ${getProduct(id).name} ${getProduct(id).en}`).join('') : '')
    const tools = TOOL_ITEMS.filter((t) => `${t.name} ${t.hint} ${t.key}${deptWords(t.key)}${productWords(t.key)}`.toLowerCase().includes(k))
    const products = withProducts ? PRODUCT_ITEMS.filter((p) => p.words.includes(k)) : []
    if (!withIntents) return [...products, ...tools]
    const compact = k.replace(/\s+/g, '')
    const intents = INTENT_ITEMS.filter((i) => i.words.includes(k) || i.words.replace(/\s+/g, '').includes(compact) || i.words.split(' ').some((w) => w && compact.includes(w)))
    return [...products, ...intents, ...tools]
  }, [q, withIntents, withDepartments, withProducts])

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
      {/* Esc は窓のどこにいても効く（入力欄の外にいるときも。点検 A11Y-03） */}
      <div className={styles.palette} role="dialog" aria-modal="true" aria-label="ツールを探す" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
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
                  <span className={styles.paletteIcon}>{t.intent ? <Sparkles size={16} aria-hidden /> : t.key.startsWith('product:') ? <ShellIcon name={t.icon ?? 'LayoutGrid'} size={16} strokeWidth={2} /> : <ToolBearIcon id={t.key} icon={t.icon ?? 'LayoutGrid'} size={28} iconSize={16} />}</span>
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

/** まとまりの見出しのアイコン（部署・製品の id → lucide の名前） */
const GROUP_ICONS: Record<string, ShellIconName> = { marketing: 'Megaphone', sales: 'Briefcase', hr: 'Users', admin: 'Wallet', budget: 'Wallet', management: 'LayoutDashboard', other: 'LayoutGrid' }

/** 開閉できるまとまり（部署の入口・製品の「ほかの製品のツール」で同じ部品を使う） */
interface NavGroup { key: string; label: string; tools: ShellTool[] }

/**
 * ツールのまとまり（ドヤマーケAI・ドヤセールスAI・ドヤ人事AI・ドヤ管理AI。経営ホームの部署のタブと同じ分け方）。
 * - 見出しを押すと開く・畳む（aria-expanded）。押した結果だけを cookie に覚え、次に開いたときも同じ形で出す。
 * - 押していないまとまりは、今いるツールのまとまりだけを開く。別のまとまりのツールへ移ったら、そのまとまりを開く。
 * - 主の部署（旗 DEPARTMENTS_ROLLOUT。経営ホームで選んだもの）があれば先に並べる。並びの決まりは buildDepartmentGroups。
 * - 768〜1279px のアイコンだけのサイドバーでは、畳まずに全部のアイコンを出す（CSS）。
 */
function ToolGroupsNav({ groups, pathname, onNavigate, prefetch, initialOpen, label = 'ツール' }: {
  groups: NavGroup[]
  /** まとまりの上の見出し */
  label?: string
  pathname: string
  onNavigate: (href: string) => void
  prefetch?: boolean
  initialOpen?: Record<string, boolean>
}) {
  const [explicit, setExplicit] = useState<Record<string, boolean>>(() => initialOpen ?? {})
  const activeGroup = groups.find((g) => g.tools.some((t) => isActive(pathname, t)))
  const activeId = activeGroup ? activeGroup.key : null
  // 畳んだまとまりのツールへ移ったら、そのまとまりを開く（今のページの項目を隠さない）
  useEffect(() => {
    if (!activeId) return
    setExplicit((prev) => (prev[activeId] === false ? { ...prev, [activeId]: true } : prev))
  }, [activeId])
  const save = (next: Record<string, boolean>) => {
    try { document.cookie = `${NAV_GROUPS_COOKIE}=${serializeNavGroups(next)}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax` } catch { /* 覚えられなくても動く */ }
  }
  const toggle = (id: string, open: boolean) => setExplicit((prev) => {
    const next = { ...prev, [id]: !open }
    save(next)
    return next
  })
  return (
    <div className={styles.group}>
      <p className={styles.groupLabel}>{label}</p>
      {groups.map((g) => {
        const id = g.key
        const open = explicit[id] ?? id === activeId
        const bodyId = `shell-group-${id}`
        const hasActive = id === activeId
        return (
          <div key={id} className={styles.deptBlock}>
            <button type="button" className={styles.deptToggle} aria-expanded={open} aria-controls={bodyId} data-active={hasActive && !open ? 'true' : undefined} onClick={() => toggle(id, open)}>
              <span className={styles.deptIcon}><ShellIcon name={GROUP_ICONS[id] ?? 'LayoutGrid'} size={16} strokeWidth={2} /></span>
              <span className={styles.navLabel}>{g.label}</span>
              <span className={styles.deptCount} aria-label={`${g.tools.length}個のツール`}>{g.tools.length}</span>
              <ChevronDown size={16} aria-hidden className={styles.deptChevron} data-open={open} />
            </button>
            <div id={bodyId} className={styles.deptBody} data-open={open} role="group" aria-label={g.label}>
              <div className={styles.deptInner}>
                {g.tools.map((tool) => <NavItem key={tool.id} tool={tool} pathname={pathname} onNavigate={onNavigate} prefetch={prefetch} />)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 「動いているタスク」の件数（/api/agent/runs/summary）。null はまだ読んでいない・読めない（件数を出さない） */
type TaskCounts = { running: number; waiting: number; done: number; failed: number }
const TASKS_HREF = '/home#home-agent-title'
const TASKS_POLL_MS = 15_000

/**
 * 経営ホームの下の「動いているタスク」。ドヤくんに任せた ToDo の、実行中・できた（24時間以内）の件数を出す。
 * - 押すと経営ホームの「ドヤくんに頼む」の欄（続きを進める・進めた仕事）へ移る。
 * - 実行中があるあいだは、点が小さく脈打つ（動きを減らす設定では止める）。15秒ごとに数え直す（画面を見ているときだけ）。
 * - 記録の表を使っていない（AGENT_RUNS_STORE が db でない）ときは、件数を出さずにリンクだけにする。
 * ⚠️ 行の高さは件数の有無で変えない（読み込みのあとに下のメニューがずれないように）。
 */
function AgentTasksRow({ pathname, onNavigate }: { pathname: string; onNavigate: (href: string) => void }) {
  const [counts, setCounts] = useState<TaskCounts | null>(null)
  const [off, setOff] = useState(false)
  const running = counts?.running ?? 0
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/runs/summary', { cache: 'no-store' })
      if (res.status === 404) { setOff(true); return }
      if (!res.ok) return
      const j = await res.json()
      if (typeof j?.running === 'number') setCounts({ running: j.running, waiting: j.waiting ?? 0, done: j.done ?? 0, failed: j.failed ?? 0 })
    } catch { /* 数えられなくてもリンクは使える */ }
  }, [])
  // ページを移るたびに数え直す（経営ホームで任せた直後に、ほかのツールへ移っても増えた数が出る）
  useEffect(() => { if (!off) void load() }, [pathname, load, off])
  useEffect(() => {
    if (off || running === 0) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load() }, TASKS_POLL_MS)
    return () => clearInterval(t)
  }, [running, load, off])
  useEffect(() => {
    if (off) return
    const onVis = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load, off])

  const done = counts?.done ?? 0
  const failed = counts?.failed ?? 0
  const label = counts
    ? running || done || failed
      ? `動いているタスク: 実行中${running}件、できた${done}件${failed ? `、止まった${failed}件` : ''}`
      : '動いているタスク: いま動いている作業はありません'
    : '動いているタスク'
  const onHome = pathname === '/home'
  return (
    <Link href={TASKS_HREF} className={`${styles.navItem} ${styles.tasksRow}`} onClick={() => onNavigate(onHome ? pathname : '/home')} title={label} aria-label={label} data-running={running > 0 ? 'true' : undefined}>
      <span className={styles.tasksIcon}>
        <ListTodo size={18} strokeWidth={2} aria-hidden />
        {running > 0 ? <span className={styles.tasksPulse} aria-hidden /> : null}
      </span>
      <span className={styles.tasksText}>
        <span className={styles.navLabel}>動いているタスク</span>
        <span className={styles.tasksMeta} aria-hidden>
          {counts && (running || done || failed) ? (
            <>
              {running ? <span className={styles.tasksChip} data-kind="running">実行中 {running}</span> : null}
              {done ? <span className={styles.tasksChip} data-kind="done">できた {done}</span> : null}
              {failed ? <span className={styles.tasksChip} data-kind="failed">止まった {failed}</span> : null}
            </>
          ) : <span className={styles.tasksNone}>{counts ? '動いている作業はありません' : 'ドヤくんに任せた作業'}</span>}
        </span>
      </span>
    </Link>
  )
}

/** HubSpot のポップアップの要素（CompanyDialog.tsx で会社情報の画面を開いている間に隠すものと同じ） */
const HIDE_HUBSPOT_CSS = '[id^="hs-web-interactives"],[class*="hs-web-interactive"],#hubspot-messages-iframe-container,.hs-overlay-container{display:none!important}'

export default function AppShell({ children, userName, initialRecent, departments, products, agentTasks = false, navGroups }: {
  children: ReactNode
  userName?: string | null
  /** 最近使ったツール（新しい見た目のとき、サーバーが cookie から読んで渡す。最初の描画から並べ、あとから押し下げない） */
  initialRecent?: string[]
  /** 部署ごとの入口（旗 DEPARTMENTS_ROLLOUT。サーバーが on と決めたときだけ渡される）。渡されなければ今のメニューのまま */
  departments?: { enabled: boolean; primary: DepartmentId[] }
  /** 部門ごとの製品（旗 PRODUCT_HUBS_ROLLOUT。サーバーが on と決めたときだけ渡される）。渡されたときは部署の入口より先に使う */
  products?: { enabled: boolean; start: ProductId; selfDefault: ProductId | null; order?: { main: ProductId[]; others: ProductId[] }; canManage?: boolean; canEditSelf?: boolean; locked?: boolean }
  /** 「動いているタスク」を出すか（旗 AGENT_ORCHESTRATION_ROLLOUT。サーバーが決める） */
  agentTasks?: boolean
  /** まとまりの開閉（cookie。押したものだけ） */
  navGroups?: Record<string, boolean>
}) {
  const pathname = usePathname() || '/'
  // 新しい見た目（チェックリスト §5.1）のときだけ、UI 品質の直し（区分の名前・押した瞬間の選択・先読み）を使う
  const toHref = useToolHref()
  const deptOn = Boolean(departments?.enabled)
  // ツールは部署のまとまり（ドヤマーケAI など）で並べる。主の部署は旗が on のときだけ使う（off なら既定の順）
  const toolGroups = useMemo<NavGroup[]>(() => buildDepartmentGroups(deptOn ? departments?.primary ?? [] : []).map((g) => ({ key: g.department ?? 'other', label: g.label, tools: g.tools })), [deptOn, departments?.primary])
  // 部門ごとの製品（docs/design/buddy-products-2026-11-01.md）。今の製品は、パスから決める（ツールが今の製品に入っていれば今のまま）
  const productsOn = Boolean(products?.enabled)
  const [product, setProduct] = useState<ProductId>(() => productForPath(pathname, products?.start ?? 'management'))
  useEffect(() => {
    if (!productsOn) return
    setProduct((cur) => productForPath(pathname, cur))
  }, [pathname, productsOn])
  // 最後に開いた製品を覚える（次にログインしたとき、既定の製品が無ければここから開く）
  useEffect(() => {
    if (!productsOn) return
    try { document.cookie = `${PRODUCT_COOKIE}=${product}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax` } catch { /* 覚えられなくても動く */ }
  }, [product, productsOn])
  const productHome = useMemo<ShellTool>(() => {
    const p = getProduct(product)
    return { id: `hub-${p.id}`, name: p.id === 'management' ? '経営ホーム' : 'ホーム', href: p.home, icon: p.icon, hint: p.hint, stage: 'other' }
  }, [product])
  const ownTools = useMemo(() => (productsOn ? productShellTools(product) : []), [product, productsOn])
  const otherGroups = useMemo<NavGroup[]>(() => (productsOn ? buildProductGroups(product).map((g) => ({ key: g.product ?? 'other', label: g.label, tools: g.tools })) : []), [product, productsOn])
  const [open, setOpen] = useState(false)
  const [palette, setPalette] = useState(false)
  // 1日1つの決まりで止めた知らせ（新機能・「〜でできること」）。あるときだけ、左下に「お知らせ」を出す
  const { enabled: noticeOn, held, openHeld } = useNotice()
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

  // スマホでメニューを開いている間は、知らせのカードを隠す（メニューの「料金プラン」などに重なるため。2026-10-27 統括の本番の確認）。
  // 隠すのは notice.module.css の側。ここでは html に印を付けるだけ。閉じたらまた出る（知らせは閉じたことにしない）
  useEffect(() => {
    const root = document.documentElement
    if (open) root.setAttribute('data-shell-menu', 'open')
    else root.removeAttribute('data-shell-menu')
    return () => root.removeAttribute('data-shell-menu')
  }, [open])

  const close = () => setOpen(false)
  // 押した瞬間に選択の表示を変える（読み込みを待たない。UI 品質 C-5）。移り終わったら実際のパスに戻す
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  useEffect(() => setPendingHref(null), [pathname])
  const shownPath = pendingHref ?? pathname
  const navigate = (href: string) => { setPendingHref(href); close() }
  const prefetch = true

  // スマホの下のタブは「ホーム・すべて・アカウント」の決まった並び。使ったツールで入れ替えない
  // （2026-10-24 分かりやすさの点検 FRM-03。左下と同じく、場面で中身が変わると分かりにくい）
  const tabTools: ShellTool[] = []

  // 左のメニューの「最近使ったツール」は出さない（2026-10-24 分かりやすさの点検 FRM-02。画面を移るたびに並びが入れ替わるため）。
  // 最近の記録（cookie・localStorage）は残す。並びの固定された欄（経営ホームなど）で使う
  const recentTools: ShellTool[] = []

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
        {productsOn ? (
          <ProductSwitcher current={product} selfDefault={products?.selfDefault ?? null} order={products?.order} canManage={products?.canManage} canEditSelf={products?.canEditSelf} locked={products?.locked} onSelect={setProduct} variant="topbar" />
        ) : (
        <Link href={SHELL_HOME.href} className={styles.brand}>
          <DoyaLogoMark size={28} className={styles.brandMark} />{brandName()}
        </Link>
        )}
        {/* ドヤパワーの残り（旗が出すと決め、残りの値があるときだけ。無ければ何も描かない） */}
        <ShellPowerMeter variant="topbar" />
        <button type="button" className={styles.iconButton} onClick={() => setPalette(true)} aria-label="ツールを探す">
          <Search size={18} />
        </button>
      </header>

      <div className={styles.scrim} data-open={open} onClick={close} aria-hidden />

      <nav className={styles.sidebar} data-open={open} aria-label="ツール一覧">
        <div className={styles.sideHead}>
          {productsOn ? (
            <ProductSwitcher current={product} selfDefault={products?.selfDefault ?? null} order={products?.order} canManage={products?.canManage} canEditSelf={products?.canEditSelf} locked={products?.locked} onSelect={(id) => { setProduct(id); close() }} variant="sidebar" labelClassName={styles.navLabel} />
          ) : (
          <Link href={SHELL_HOME.href} className={styles.brand} onClick={close}>
            <DoyaLogoMark size={28} className={styles.brandMark} />
            <span className={styles.navLabel}>{brandName()}</span>
          </Link>
          )}
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
          <NavItem tool={productsOn ? productHome : SHELL_HOME} pathname={shownPath} onNavigate={navigate} prefetch={prefetch} />
          {agentTasks ? <AgentTasksRow pathname={pathname} onNavigate={navigate} /> : null}
          {recentTools.length ? (
            <div className={styles.group}>
              <p className={styles.groupLabel}>最近使ったツール</p>
              {recentTools.map((tool) => (
                <NavItem key={tool.id} tool={tool} pathname={shownPath} onNavigate={navigate} prefetch={prefetch} mirror />
              ))}
            </div>
          ) : null}
          {productsOn ? (
            <>
              {/* 今の製品のツール（畳まずに並べる）。経営管理は、全部の製品を下のまとまりから開く */}
              {ownTools.length ? (
                <div className={styles.group}>
                  <p className={styles.groupLabel}>{getProduct(product).name}のツール</p>
                  {ownTools.map((tool) => <NavItem key={tool.id} tool={tool} pathname={shownPath} onNavigate={navigate} prefetch={prefetch} />)}
                </div>
              ) : null}
              {/* ほかの製品のツールも開ける（2026-11-01 の決定「担当でない製品のツールも開けるまま」）。今いるツールのまとまりだけ開く */}
              <ToolGroupsNav key={product} groups={otherGroups} pathname={shownPath} onNavigate={navigate} prefetch={prefetch} initialOpen={navGroups} label="ほかの製品のツール" />
            </>
          ) : (
            <>
              {/* 部署のまとまり（開閉つき）は旗 DEPARTMENTS_ROLLOUT が on のときだけ。off なら今までの区分のまま（2026-11-02 本人の指示「旗の裏に入れてから」） */}
              {deptOn ? (
                <ToolGroupsNav groups={toolGroups} pathname={shownPath} onNavigate={navigate} prefetch={prefetch} initialOpen={navGroups} />
              ) : SHELL_GROUPS.map((group) => (
                <div key={group.stage} className={styles.group}>
                  <p className={styles.groupLabel}>{group.label}</p>
                  {group.tools.map((tool) => (
                    <NavItem key={tool.id} tool={tool} pathname={shownPath} onNavigate={navigate} prefetch={prefetch} />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
        {/* 新しい見た目では、左下はどの画面でも同じもの（登録会社・ドヤパワー・アカウント・ログアウト）だけにする。
            ツールごとの「作った数 / 残り」は、ツールの見出しの帯（ToolFrame）に出す（2026-10-24 ユーザーの指摘「ツールを押すごとに変わるのは分かりにくい」） */}
        <div className={styles.account} id="shell-account">
          {/* 登録会社と切り替え（中身が出る。UI 品質 B-1） */}
          <ShellCompanyCard />
          <ShellPowerMeter variant="sidebar" />
          {userName ? <p className={styles.userLine}>{userName} さん</p> : null}
          {/* 行は知らせの部品があればいつも置く（読み込みのあとに足すと、下の料金プランとログアウトがずれるため）。無いときは押せない */}
          {noticeOn ? (
            <button type="button" className={`${styles.navItem} ${styles.logout} ${styles.noticeRow}`} disabled={!held.length} onClick={() => { if (!held.length) return; close(); openHeld(held[0].id) }} title={held.length ? `お知らせ（${held.length}件）` : '新しいお知らせはありません'}>
              <span className={styles.noticeIcon}>
                <Bell size={18} strokeWidth={2} aria-hidden />
                {held.length ? <span className={styles.noticeDot} aria-hidden /> : null}
              </span>
              <span className={styles.navLabel}>お知らせ{held.length ? <span className={styles.noticeCount}>{held.length}</span> : null}</span>
            </button>
          ) : null}
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
        {[productsOn ? productHome : SHELL_HOME, ...tabTools].map((t) => {
          return (
            <Link key={t.id} href={toHref(t.href)} className={styles.tab} aria-current={isActive(pathname, t) ? 'page' : undefined}>
              <ToolBearIcon id={t.id} icon={t.icon} size={26} iconSize={20} />
              <span>{t.id === 'home' || t.id.startsWith('hub-') ? 'ホーム' : t.name}</span>
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

      <CommandPalette open={palette} onClose={() => setPalette(false)} withIntents={true} withDepartments={deptOn && !productsOn} withProducts={productsOn} />
    </div>
    </ShellUsageProvider>
    </InShellContext.Provider>
  )
}
