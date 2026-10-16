'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown, Command, Home, Image as ImageIcon, Map as MapIcon, Menu, PenLine, Search, X } from 'lucide-react'
import s from './renewal.module.css'
import { HomeScreen } from './HomeScreen'
import { MapScreen } from './MapScreen'
import { BannerTool } from './BannerTool'
import { ArticleTool } from './ArticleTool'
import { HOME, STAGES, mascotOf, stageServices } from './data'

type Screen = 'home' | 'map' | 'banner' | 'seo'
const TOOL_SCREENS: Record<string, Screen> = { banner: 'banner', seo: 'seo' }

export function RenewalApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [navOpen, setNavOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ attract: true, sell: true })

  const go = (next: Screen) => {
    setScreen(next)
    setNavOpen(false)
    setPaletteOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openService = (id: string) => {
    const target = TOOL_SCREENS[id]
    if (target) return go(target)
    setPaletteOpen(false)
    setToast('この見本で操作できるのは、ドヤバナーAIとドヤ記事作成です')
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
        setPaletteOpen((v) => !v)
      }
      if (e.key === 'Escape') setPaletteOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={s.root}>
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

          <button type="button" className={s.searchBtn} onClick={() => setPaletteOpen(true)}>
            <Search size={15} strokeWidth={2} />
            <span>AIを探す</span>
            <kbd>
              <Command size={11} strokeWidth={2.5} />K
            </kbd>
          </button>

          <nav className={s.nav} aria-label="メイン">
            <NavItem icon={<Home size={17} strokeWidth={1.75} />} label="ホーム" on={screen === 'home'} onClick={() => go('home')} />
            <NavItem icon={<MapIcon size={17} strokeWidth={1.75} />} label="業務マップ" on={screen === 'map'} onClick={() => go('map')} />

            <p className={s.navCap}>よく使う</p>
            <NavItem icon={<ImageIcon size={17} strokeWidth={1.75} />} label="ドヤバナーAI" on={screen === 'banner'} onClick={() => go('banner')} />
            <NavItem icon={<PenLine size={17} strokeWidth={1.75} />} label="ドヤ記事作成" on={screen === 'seo'} onClick={() => go('seo')} />

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
                          className={`${s.navSvc} ${TOOL_SCREENS[svc.id] === screen ? s.navSvcOn : ''}`}
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
              {{ home: 'ホーム', map: '業務マップ', banner: 'ドヤバナーAI', seo: 'ドヤ記事作成' }[screen]}
            </span>
            <button type="button" className={s.topSearch} onClick={() => setPaletteOpen(true)} aria-label="AIを探す">
              <Search size={18} />
            </button>
            <span className={s.avatar} aria-hidden="true">
              ミ
            </span>
          </div>

          <div key={screen} className={s.screenIn}>
            {screen === 'home' && <HomeScreen onOpen={openService} />}
            {screen === 'map' && <MapScreen onOpen={openService} />}
            {screen === 'banner' && <BannerTool />}
            {screen === 'seo' && <ArticleTool />}
          </div>
        </main>
      </div>

      <nav className={s.tabbar} aria-label="スマホ用メニュー">
        {(
          [
            ['home', 'ホーム', <Home key="h" size={20} strokeWidth={1.75} />],
            ['map', 'マップ', <MapIcon key="m" size={20} strokeWidth={1.75} />],
            ['banner', 'バナー', <ImageIcon key="b" size={20} strokeWidth={1.75} />],
            ['seo', '記事', <PenLine key="s" size={20} strokeWidth={1.75} />],
          ] as const
        ).map(([id, label, icon]) => (
          <button key={id} type="button" aria-current={screen === id ? 'page' : undefined} onClick={() => go(id)}>
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {paletteOpen && <Palette onClose={() => setPaletteOpen(false)} onOpen={openService} onGo={go} />}
      {toast && (
        <div className={s.toast} role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function NavItem({ icon, label, on, onClick }: { icon: React.ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${s.navItem} ${on ? s.navOn : ''}`} onClick={onClick} aria-current={on ? 'page' : undefined}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ⌘K：サービス名でも「やりたいこと」でも引ける
function Palette({ onClose, onOpen, onGo }: { onClose: () => void; onOpen: (id: string) => void; onGo: (s: Screen) => void }) {
  const [q, setQ] = useState('')
  const all = useMemo(
    () => STAGES.flatMap((st) => stageServices(st).map((svc) => ({ ...svc, stage: st }))),
    [],
  )
  const hits = all.filter((x) => !q || `${x.name}${x.description}${x.stage.label}${x.stage.role}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className={s.paletteScrim} onClick={onClose}>
      <div className={s.palette} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="AIを探す">
        <div className={s.paletteInput}>
          <Search size={18} strokeWidth={2} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="例：バナー、商談、面接、勤怠" />
          <kbd>esc</kbd>
        </div>
        {!q && (
          <div className={s.paletteQuick}>
            <button type="button" onClick={() => onGo('home')}>
              <Home size={14} /> ホーム
            </button>
            <button type="button" onClick={() => onGo('map')}>
              <MapIcon size={14} /> 業務マップ
            </button>
          </div>
        )}
        <ul className={s.paletteList}>
          {hits.map((x, i) => (
            <li key={x.id} style={{ '--i': i } as CSSProperties}>
              <button type="button" onClick={() => onOpen(x.id)}>
                <img src={mascotOf(x.id)} alt="" />
                <span>
                  <strong>{x.name}</strong>
                  <small>{x.description}</small>
                </span>
                <em style={{ color: x.stage.ink, background: `${x.stage.color}14` }}>{x.stage.label}</em>
              </button>
            </li>
          ))}
          {hits.length === 0 && <li className={s.paletteEmpty}>見つかりませんでした。言い方を変えてみてください。</li>}
        </ul>
      </div>
    </div>
  )
}
