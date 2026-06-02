'use client'

import Link from 'next/link'
import NextImage from 'next/image'
import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  Check,
  ChevronUp,
  ChevronDown,
  Clock,
  Database,
  FileText,
  Film,
  Image,
  LayoutGrid,
  Mic,
  PenLine,
  Send,
  Sparkles,
  Target,
  Play,
  Presentation,
  Users,
  Volume2,
  type LucideIcon,
} from 'lucide-react'
import { getActiveServices } from '@/lib/services'

// services.ts の id → 公式ロゴ画像（あれば優先表示）
const SERVICE_LOGO: Record<string, string> = {
  banner: '/banner/logo.png',
  seo: '/seo/logo.png',
  interview: '/interview/logo.png',
  persona: '/persona/logo.png',
  kintai: '/kintai/logo.png',
  doyalist: '/doyalist/logo.png',
  promane: '/promane/logo.png',
  hr: '/hr/logo.png',
}

// ロゴが無いサービス用フォールバック（色タイル + Lucide シンボル）
type ServiceMapping = { icon: LucideIcon; iconBg: string; hoverBg: string }

const SERVICE_ICON_MAP: Record<string, ServiceMapping> = {
  banner:    { icon: Image,     iconBg: 'from-fuchsia-500 to-pink-500',  hoverBg: 'hover:bg-pink-50' },
  seo:       { icon: FileText,  iconBg: 'from-slate-700 to-slate-900',   hoverBg: 'hover:bg-slate-50' },
  interview: { icon: Mic,       iconBg: 'from-orange-500 to-amber-500',  hoverBg: 'hover:bg-orange-50' },
  persona:   { icon: Target,    iconBg: 'from-violet-500 to-purple-600', hoverBg: 'hover:bg-violet-50' },
  kintai:    { icon: Clock,     iconBg: 'from-cyan-500 to-blue-500',     hoverBg: 'hover:bg-cyan-50' },
  doyalist:  { icon: Database,  iconBg: 'from-emerald-500 to-teal-600',  hoverBg: 'hover:bg-emerald-50' },
  promane:   { icon: BarChart3, iconBg: 'from-blue-600 to-indigo-600',   hoverBg: 'hover:bg-blue-50' },
  kantan:    { icon: Sparkles,  iconBg: 'from-emerald-500 to-teal-500',  hoverBg: 'hover:bg-emerald-50' },
  opening:   { icon: Play,      iconBg: 'from-red-500 to-rose-600',      hoverBg: 'hover:bg-rose-50' },
  voice:     { icon: Volume2,   iconBg: 'from-violet-500 to-purple-500', hoverBg: 'hover:bg-violet-50' },
  lp:        { icon: LayoutGrid, iconBg: 'from-cyan-500 to-blue-500',    hoverBg: 'hover:bg-cyan-50' },
  copy:      { icon: PenLine,   iconBg: 'from-amber-500 to-orange-500',  hoverBg: 'hover:bg-amber-50' },
  movie:     { icon: Film,      iconBg: 'from-rose-500 to-pink-500',     hoverBg: 'hover:bg-rose-50' },
  interviewx: { icon: Send,     iconBg: 'from-indigo-500 to-violet-500', hoverBg: 'hover:bg-indigo-50' },
  adsim:     { icon: BarChart3, iconBg: 'from-indigo-500 to-blue-600',   hoverBg: 'hover:bg-indigo-50' },
  hr:        { icon: Users,     iconBg: 'from-sky-500 to-blue-600',      hoverBg: 'hover:bg-sky-50' },
  doyaslide: { icon: Presentation, iconBg: 'from-blue-500 to-indigo-600', hoverBg: 'hover:bg-blue-50' },
}

const FALLBACK_MAPPING: ServiceMapping = {
  icon: Sparkles,
  iconBg: 'from-slate-500 to-slate-700',
  hoverBg: 'hover:bg-slate-50',
}

/**
 * ツールのビジュアル。公式ロゴがあれば白カードに大きく contain 表示、
 * 無ければ色タイル + Lucide シンボル。ロゴはアスペクト比がバラバラ
 * （正方形 / 横長混在）なので固定高さ・中央寄せで揃える。
 */
function ServiceVisual({ id, active = false }: { id: string; active?: boolean }) {
  const logo = SERVICE_LOGO[id]
  if (logo) {
    return (
      <div
        className={`w-full h-20 rounded-xl bg-white flex items-center justify-center overflow-hidden px-3 py-2 ${
          active ? 'ring-2 ring-[#7f19e6]/40' : 'ring-1 ring-slate-200'
        }`}
      >
        <NextImage
          src={logo}
          alt=""
          width={360}
          height={200}
          className="max-h-full w-auto object-contain"
        />
      </div>
    )
  }
  const mapping = SERVICE_ICON_MAP[id] || FALLBACK_MAPPING
  const Icon = mapping.icon
  return (
    <div
      className={`w-full h-20 rounded-xl bg-gradient-to-br ${mapping.iconBg} flex items-center justify-center ${
        active ? 'ring-2 ring-[#7f19e6]/40' : ''
      }`}
    >
      <Icon className="w-7 h-7 text-white" strokeWidth={2.25} />
    </div>
  )
}

type ToolSwitcherMenuProps = {
  currentService: string // services.ts の id
  showLabel: boolean
  isCollapsed: boolean
  isMobile?: boolean
  className?: string
}

export function ToolSwitcherMenu({ currentService, showLabel, className }: ToolSwitcherMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('up')
  const buttonRef = useRef<HTMLButtonElement>(null)

  // ボタン位置に基づいて展開方向を決定
  const detectDirection = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    setOpenDirection(rect.top + rect.height / 2 < viewportHeight / 2 ? 'down' : 'up')
  }, [])

  const handleToggle = useCallback(() => {
    if (!isOpen) detectDirection()
    setIsOpen((v) => !v)
  }, [isOpen, detectDirection])

  // 外部クリックで閉じる
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Esc で閉じる
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen])

  const activeServices = getActiveServices()
  const otherCount = activeServices.filter(s => s.id !== currentService).length
  // 現在のサービスを先頭に並べ替え
  const ordered = [
    ...activeServices.filter(s => s.id === currentService),
    ...activeServices.filter(s => s.id !== currentService),
  ]

  const isUp = openDirection === 'up'
  const ChevronIcon = isUp ? ChevronUp : ChevronDown

  return (
    <div className={className || ''}>
      <div className="relative" ref={containerRef}>
        {/* メインボタン */}
        <button
          ref={buttonRef}
          onClick={handleToggle}
          className={`group w-full flex items-center gap-2 px-3 py-3 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all text-white ${
            !showLabel ? 'justify-center' : 'justify-between'
          }`}
          title="他のツールを使う"
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            <AnimatePresence>
              {showLabel && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  className="flex flex-col items-start"
                >
                  <span className="text-xs font-black leading-tight">他のツールを使う</span>
                  <span className="text-[10px] font-bold text-white/70 leading-tight">
                    {otherCount}つのAIツールが利用可能
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {showLabel && (
            <ChevronIcon className={`w-4 h-4 text-white/80 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>

        {/* ドロップダウンメニュー */}
        <AnimatePresence>
          {isOpen && showLabel && (
            <motion.div
              initial={{ opacity: 0, y: isUp ? -8 : 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: isUp ? -8 : 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              role="menu"
              className={`absolute left-0 right-0 flex flex-col bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 border border-gray-100 overflow-hidden z-[200] max-h-[min(34rem,72dvh)] ${
                isUp ? 'bottom-full mb-2' : 'top-full mt-2'
              }`}
            >
              {/* ヘッダー（固定） */}
              <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 flex-shrink-0 border-b border-slate-100">
                <span className="grid place-items-center w-6 h-6 rounded-md bg-gradient-to-br from-[#7f19e6] to-fuchsia-500 text-white">
                  <LayoutGrid className="w-3.5 h-3.5" />
                </span>
                <div className="leading-tight">
                  <p className="text-[13px] font-black text-slate-900">ツールを切り替え</p>
                  <p className="text-[10px] font-bold text-slate-400">{activeServices.length}つのAIツールが利用可能</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1.5">
                {ordered.map((service) => {
                  const hoverBg = (SERVICE_ICON_MAP[service.id] || FALLBACK_MAPPING).hoverBg
                  const isCurrent = service.id === currentService
                  const isNew = service.badge === 'NEW' || service.isNew

                  if (isCurrent) {
                    return (
                      <div
                        key={service.id}
                        className="rounded-2xl p-2 bg-gradient-to-br from-[#7f19e6]/[0.08] to-fuchsia-500/[0.05] ring-1 ring-[#7f19e6]/20"
                        role="menuitem"
                        aria-current="true"
                      >
                        <ServiceVisual id={service.id} active />
                        <div className="flex items-center justify-between gap-2 px-1 pt-1.5">
                          <p className="text-[13px] font-black text-slate-900 truncate min-w-0">{service.name}</p>
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#7f19e6] text-white text-[10px] font-black flex-shrink-0">
                            <Check className="w-3 h-3" strokeWidth={3} />
                            使用中
                          </span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={service.id}
                      href={service.dashboardHref}
                      className={`block rounded-2xl p-2 transition-colors ${hoverBg}`}
                      onClick={() => setIsOpen(false)}
                      role="menuitem"
                    >
                      <ServiceVisual id={service.id} />
                      <div className="flex items-center gap-1.5 px-1 pt-1.5">
                        <p className="text-[13px] font-black text-slate-800 truncate min-w-0">{service.name}</p>
                        {isNew && (
                          <span className="px-1 py-px rounded bg-rose-500 text-white text-[8px] font-black leading-none flex-shrink-0">
                            NEW
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* フッター（固定） */}
              <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-50 border-t border-slate-100 flex-shrink-0">
                <Check className="w-3 h-3 text-emerald-500" strokeWidth={3} />
                <p className="text-[10px] font-bold text-slate-400">すべて同じアカウントで利用可能</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
