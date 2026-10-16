'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  Command,
  CornerDownLeft,
  Home,
  Image as ImageIcon,
  Map as MapIcon,
  Menu,
  Palette as PaletteIcon,
  PenLine,
  Search,
  Sparkles,
  History,
  LayoutGrid,
  X,
} from 'lucide-react'
import s from './renewal.module.css'
import { HomeScreen } from './HomeScreen'
import { MapScreen } from './MapScreen'
import { BannerTool } from './BannerTool'
import { ArticleTool } from './ArticleTool'
import { HOME, STAGES, mascotOf, stageServices } from './data'
import { Cursor } from './Cursor'
import { DESIGNS, DesignDock, useDesign, type Design } from './design'
import { SERVICE_TOOLS } from './tools/registry'
import { getServiceById } from '@/lib/services'

type Screen = 'home' | 'map' | 'banner' | 'seo' | 'svc'
const TOOL_SCREENS: Record<string, Screen> = { banner: 'banner', seo: 'seo' }

// 「AIに頼む」の文から、使うAIを決める（見本なので単純な言葉の一致）
const INTENTS: { words: string[]; id: string }[] = [
  { words: ['バナー', '広告画像', 'クリエイティブ'], id: 'banner' },
  { words: ['記事', 'SEO', 'ブログ', '構成'], id: 'seo' },
  { words: ['商談', '企業調査', '提案'], id: 'shodan' },
  { words: ['面接', '採用', '応募'], id: 'mensetsu' },
  { words: ['リスト', '営業先'], id: 'doyalist' },
  { words: ['見積'], id: 'quote' },
  { words: ['勤怠', '打刻'], id: 'kintai' },
  { words: ['スライド', '資料'], id: 'doyaslide' },
  { words: ['広告画像', '入稿'], id: 'adimage' },
  { words: ['インタビュー', '取材', '文字起こし'], id: 'interview' },
  { words: ['ペルソナ', 'ターゲット像'], id: 'persona' },
  { words: ['AI検索', 'ChatGPT', 'AIO', 'AEO'], id: 'aio' },
  { words: ['質問リンク', 'AIに聞く'], id: 'asklink' },
  { words: ['一次商談', 'AI商談'], id: 'aishodan' },
  { words: ['営業管理', 'SFA', 'パイプライン'], id: 'sfa' },
  { words: ['カンペ', 'カンニング', 'Web会議'], id: 'cunning' },
  { words: ['人事', '評価', 'タレント'], id: 'hr' },
  { words: ['案件', '進捗', 'ガント', 'プロマネ'], id: 'promane' },
]
const RECENT_KEY = 'doya-ui-renewal-recent'
const intentOf = (text: string) => INTENTS.find((it) => it.words.some((w) => text.toLowerCase().includes(w.toLowerCase())))?.id

export function RenewalApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [svcId, setSvcId] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const { design, setDesign, cursorOn, setCursorOn } = useDesign()
  const rootRef = useRef<HTMLDivElement>(null)
  const nextDesign = () => setDesign(DESIGNS[(DESIGNS.findIndex((d) => d.id === design) + 1) % DESIGNS.length].id)

  // 案を変えた瞬間だけ、色が流れ込む演出を当てる（root の className は固定なので直接付け外しする）
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    el.classList.remove(s.designSwap)
    void el.offsetWidth
    el.classList.add(s.designSwap)
  }, [design])

  // カーソルに追従する光（Linear / Vercel のカード）
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest?.('[data-spot]') as HTMLElement | null
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ attract: true, sell: true })

  const go = (next: Screen) => {
    setScreen(next)
    setNavOpen(false)
    setPaletteOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  // 最近使ったAI（閲覧者ごとの好み。保存できない環境では毎回空から始まる）
  const [recent, setRecent] = useState<string[]>([])
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]')
      if (Array.isArray(saved)) setRecent(saved.filter((id) => typeof id === 'string' && getServiceById(id)).slice(0, 3))
    } catch {}
  }, [])
  const remember = (id: string) => {
    setRecent((r) => {
      const next = [id, ...r.filter((x) => x !== id)].slice(0, 3)
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }
  const isOpen = (id: string) => (TOOL_SCREENS[id] ? screen === TOOL_SCREENS[id] : screen === 'svc' && svcId === id)

  const openService = (id: string) => {
    const target = TOOL_SCREENS[id]
    if (target) {
      remember(id)
      return go(target)
    }
    if (SERVICE_TOOLS[id]) {
      remember(id)
      setSvcId(id)
      return go('svc')
    }
    setPaletteOpen(false)
    setToast('このAIの見本は準備中です')
  }

  // ?s=サービスID で、そのAIの画面を直接開く（共有・確認用）
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('s')
    if (!id) return
    if (TOOL_SCREENS[id]) setScreen(TOOL_SCREENS[id])
    else if (SERVICE_TOOLS[id]) {
      setSvcId(id)
      setScreen('svc')
    }
  }, [])
  // 初回は ?s= を読む前なので URL を書き換えない（読む前に消してしまうのを防ぐ）
  const urlReady = useRef(false)
  useEffect(() => {
    if (!urlReady.current) {
      urlReady.current = true
      return
    }
    const url = new URL(window.location.href)
    const id = screen === 'svc' ? svcId : screen === 'banner' || screen === 'seo' ? screen : null
    if (id) url.searchParams.set('s', id)
    else url.searchParams.delete('s')
    window.history.replaceState(null, '', url)
  }, [screen, svcId])
  const SvcTool = svcId ? SERVICE_TOOLS[svcId] : null
  const openPalette = (query = '') => {
    setPaletteQuery(query)
    setPaletteOpen(true)
  }
  const onAsk = (text: string) => {
    const id = intentOf(text)
    if (id) return openService(id)
    openPalette(text)
  }

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteQuery('')
        setPaletteOpen((v) => !v)
      }
      if (e.key === 'Escape') setPaletteOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div ref={rootRef} className={s.root} data-design={design} data-cursor-fx={cursorOn ? 'on' : 'off'} onPointerMove={onPointerMove}>
      <Cursor enabled={cursorOn} />
      <div className={s.proposalBar}>
        <span className={s.proposalTag}>提案</span>
        UIリニューアル案の見本です。数値・画像はすべて見本で、実際のデータは使っていません。
      </div>

      <div className={s.shell}>
        <aside className={`${s.side} ${navOpen ? s.sideOpen : ''}`}>
          <div className={s.brand}>
            <img src="/character/hello-256.webp" alt="" width={34} height={34} />
            <span>ドヤAI</span>
            <button type="button" className={s.sideClose} onClick={() => setNavOpen(false)} aria-label="メニューを閉じる">
              <X size={18} />
            </button>
          </div>

          <button type="button" className={s.searchBtn} onClick={() => openPalette()}>
            <Search size={15} strokeWidth={2} />
            <span>AIを探す</span>
            <kbd>
              <Command size={11} strokeWidth={2.5} />K
            </kbd>
          </button>

          <nav className={s.nav} aria-label="メイン">
            <NavItem icon={<Home size={17} strokeWidth={1.75} />} label="ホーム" on={screen === 'home'} onClick={() => go('home')} />
            <NavItem icon={<MapIcon size={17} strokeWidth={1.75} />} label="業務マップ" on={screen === 'map'} onClick={() => go('map')} />

            {recent.length > 0 && (
              <>
                <p className={s.navCap}>最近使ったAI</p>
                {recent.map((id) => (
                  <NavItem
                    key={id}
                    icon={<img src={mascotOf(id)} alt="" width={20} height={20} className={s.navMascot} />}
                    label={getServiceById(id)?.name ?? id}
                    on={isOpen(id)}
                    onClick={() => openService(id)}
                  />
                ))}
              </>
            )}

            <p className={s.navCap}>すべてのAI</p>
            {STAGES.map((st) => {
              const open = !!openGroups[st.id]
              return (
                <div key={st.id} className={s.navGroup} style={{ '--c': st.color } as CSSProperties}>
                  <button
                    type="button"
                    className={s.navGroupHead}
                    aria-expanded={open}
                    onClick={() => setOpenGroups({ ...openGroups, [st.id]: !open })}
                  >
                    <i />
                    {st.label}
                    <small>{st.serviceIds.length}</small>
                    <ChevronDown size={14} strokeWidth={2} className={open ? s.chevOpen : ''} />
                  </button>
                  <div className={`${s.navGroupBody} ${open ? s.navGroupOpen : ''}`}>
                    <div>
                      {stageServices(st).map((svc) => (
                        <button
                          key={svc.id}
                          type="button"
                          className={`${s.navSvc} ${TOOL_SCREENS[svc.id] === screen || (screen === 'svc' && svcId === svc.id) ? s.navSvcOn : ''}`}
                          onClick={() => openService(svc.id)}
                        >
                          {svc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </nav>

          <div className={s.planCard}>
            <p>
              プロプラン<span>全AI使い放題</span>
            </p>
            <div className={s.planMeter}>
              <span style={{ '--w': HOME.remaining / HOME.dailyLimit } as CSSProperties} />
            </div>
            <p className={s.planFoot}>
              今日の残り <b>{HOME.remaining}</b> / {HOME.dailyLimit}回
            </p>
          </div>
        </aside>
        {navOpen && <div className={s.sideScrim} onClick={() => setNavOpen(false)} />}

        <main className={s.main}>
          <div className={s.topbar}>
            <button type="button" className={s.menuBtn} onClick={() => setNavOpen(true)} aria-label="メニューを開く">
              <Menu size={20} />
            </button>
            <span className={s.topbarTitle}>
              {screen === 'svc'
                ? getServiceById(svcId ?? '')?.name
                : { home: 'ホーム', map: '業務マップ', banner: 'ドヤバナーAI', seo: 'ドヤ記事作成' }[screen]}
            </span>
            <button type="button" className={s.topSearch} onClick={() => openPalette()} aria-label="AIを探す">
              <Search size={18} />
            </button>
            <button type="button" className={s.themeBtn} onClick={nextDesign} aria-label="次のデザイン案にする" data-cursor="次の案">
              <span key={design} className={s.themeIcon}>
                <PaletteIcon size={18} />
              </span>
            </button>
            <span className={s.avatar} aria-hidden="true">
              ミ
            </span>
          </div>

          <div key={screen === 'svc' ? `svc-${svcId}` : screen} className={s.screenIn}>
            {screen === 'home' && <HomeScreen onOpen={openService} onAsk={onAsk} />}
            {screen === 'map' && <MapScreen onOpen={openService} />}
            {screen === 'banner' && <BannerTool />}
            {screen === 'seo' && <ArticleTool />}
            {screen === 'svc' && SvcTool && <SvcTool />}
          </div>
        </main>
      </div>

      <nav className={s.tabbar} aria-label="スマホ用メニュー">
        {/* いつも5つ・等幅。固定のAIは置かず、中央に「頼む」、右に最近使ったAIとすべてのAI */}
        <TabItem label="ホーム" icon={<Home size={21} strokeWidth={1.75} />} on={screen === 'home'} onClick={() => go('home')} />
        <TabItem label="マップ" icon={<MapIcon size={21} strokeWidth={1.75} />} on={screen === 'map'} onClick={() => go('map')} />
        <button type="button" className={s.tabAsk} onClick={() => openPalette()} aria-label="AIに頼む">
          <span>
            <Sparkles size={20} strokeWidth={2} />
          </span>
          <small>頼む</small>
        </button>
        {recent[0] ? (
          <TabItem
            label={getServiceById(recent[0])?.shortName ?? '最近'}
            icon={<History size={21} strokeWidth={1.75} />}
            on={isOpen(recent[0])}
            onClick={() => openService(recent[0])}
          />
        ) : (
          <TabItem label="最近" icon={<History size={21} strokeWidth={1.75} />} on={false} onClick={() => openPalette()} />
        )}
        <TabItem label="すべて" icon={<LayoutGrid size={21} strokeWidth={1.75} />} on={navOpen} onClick={() => setNavOpen(true)} />
      </nav>

      <DesignDock design={design} onChange={setDesign} cursorOn={cursorOn} onCursor={setCursorOn} />
      {paletteOpen && (
        <Palette
          initialQuery={paletteQuery}
          design={design}
          onClose={() => setPaletteOpen(false)}
          onOpen={openService}
          onGo={go}
          onDesign={(d) => {
            setDesign(d)
            setPaletteOpen(false)
          }}
        />
      )}
      {toast && (
        <div className={s.toast} role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function TabItem({ icon, label, on, onClick }: { icon: React.ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={s.tabItem} aria-current={on ? 'page' : undefined} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {on && <motion.i layoutId="rn-tab-dot" className={s.tabDot} transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
    </button>
  )
}

function NavItem({ icon, label, on, onClick }: { icon: React.ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${s.navItem} ${on ? s.navOn : ''}`} onClick={onClick} aria-current={on ? 'page' : undefined}>
      {on && <motion.span layoutId="rn-nav-pill" className={s.navPill} transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ⌘K（Raycast 型）：操作とAIを1つの一覧で。矢印キーで選んで Enter
type PaletteItem = {
  key: string
  group: '操作' | 'AI'
  title: string
  sub: string
  icon?: React.ReactNode
  image?: string
  tag?: { label: string; color: string; ink: string }
  run: () => void
}

function Palette({
  initialQuery,
  design,
  onClose,
  onOpen,
  onGo,
  onDesign,
}: {
  initialQuery: string
  design: Design
  onClose: () => void
  onOpen: (id: string) => void
  onGo: (s: Screen) => void
  onDesign: (d: Design) => void
}) {
  const [q, setQ] = useState(initialQuery)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const items = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = [
      { key: 'a-banner', group: '操作', title: 'バナーをつくる', sub: 'ドヤバナーAI', icon: <ImageIcon size={16} />, run: () => onGo('banner') },
      { key: 'a-article', group: '操作', title: '記事を書く', sub: 'ドヤ記事作成', icon: <PenLine size={16} />, run: () => onGo('seo') },
      { key: 'a-home', group: '操作', title: 'ホームへ', sub: '今月のまとめ', icon: <Home size={16} />, run: () => onGo('home') },
      { key: 'a-map', group: '操作', title: '業務マップを開く', sub: '仕事の流れからAIを選ぶ', icon: <MapIcon size={16} />, run: () => onGo('map') },
      ...DESIGNS.filter((d) => d.id !== design).map((d) => ({
        key: `a-design-${d.id}`,
        group: '操作' as const,
        title: `デザイン案「${d.label}」にする`,
        sub: d.note,
        icon: <span className={s.paletteSwatch} style={{ background: d.swatch }} />,
        run: () => onDesign(d.id),
      })),
    ]
    const ais: PaletteItem[] = STAGES.flatMap((st) =>
      stageServices(st).map((svc) => ({
        key: svc.id,
        group: 'AI' as const,
        title: svc.name,
        sub: svc.description,
        image: mascotOf(svc.id),
        tag: { label: st.label, color: st.color, ink: st.ink },
        run: () => onOpen(svc.id),
      })),
    )
    const needle = q.trim().toLowerCase()
    return [...actions, ...ais].filter((it) => !needle || `${it.title}${it.sub}${it.tag?.label ?? ''}`.toLowerCase().includes(needle))
  }, [q, design, onGo, onOpen, onDesign])

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      items[active]?.run()
    }
  }

  let lastGroup = ''
  return (
    <div className={s.paletteScrim} onClick={onClose}>
      <div className={s.palette} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="AIを探す">
        <div className={s.paletteInput}>
          <Search size={18} strokeWidth={2} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="やりたいこと・AIの名前で探す"
            role="combobox"
            aria-expanded="true"
            aria-controls="rn-palette-list"
          />
          <kbd>esc</kbd>
        </div>
        <ul className={s.paletteList} ref={listRef} id="rn-palette-list" role="listbox">
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null
            lastGroup = it.group
            return (
              <li key={it.key} style={{ '--i': i } as CSSProperties} role="presentation">
                {head && <p className={s.paletteGroup}>{head}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active ? '' : undefined}
                  onMouseMove={() => setActive(i)}
                  onClick={it.run}
                >
                  {it.image ? <img src={it.image} alt="" /> : <span className={s.paletteIcon}>{it.icon}</span>}
                  <span>
                    <strong>{it.title}</strong>
                    <small>{it.sub}</small>
                  </span>
                  {it.tag ? (
                    <em style={{ color: it.tag.ink, background: `${it.tag.color}1f` }}>{it.tag.label}</em>
                  ) : (
                    <ArrowRight size={15} className={s.paletteArw} />
                  )}
                </button>
              </li>
            )
          })}
          {items.length === 0 && <li className={s.paletteEmpty}>見つかりませんでした。言い方を変えてみてください。</li>}
        </ul>
        <div className={s.paletteFoot}>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 選ぶ
          </span>
          <span>
            <kbd>
              <CornerDownLeft size={11} />
            </kbd>{' '}
            開く
          </span>
          <span className={s.paletteBrand}>ドヤAI</span>
        </div>
      </div>
    </div>
  )
}
