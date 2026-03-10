'use client'

import Link from 'next/link'
import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronUp,
  ChevronDown,
  ExternalLink,
  FileText,
  Film,
  Image,
  LayoutGrid,
  Mic,
  PenLine,
  Send,
  Target,
  Sparkles,
  Play,
  Volume2,
  type LucideIcon,
} from 'lucide-react'
import { getActiveServices } from '@/lib/services'

// services.ts の id → lucide アイコン & グラデーション
const SERVICE_ICON_MAP: Record<string, { icon: LucideIcon; iconBg: string }> = {
  kantan:    { icon: Sparkles, iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500' },
  banner:    { icon: Image,    iconBg: 'bg-gradient-to-br from-purple-500 to-pink-500' },
  seo:       { icon: FileText, iconBg: 'bg-gradient-to-br from-slate-700 to-slate-900' },
  interview: { icon: Mic,      iconBg: 'bg-gradient-to-br from-orange-500 to-amber-500' },
  opening:   { icon: Play,     iconBg: 'bg-gradient-to-br from-red-500 to-rose-600' },
  persona:   { icon: Target,   iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600' },
  voice:     { icon: Volume2,  iconBg: 'bg-gradient-to-br from-violet-500 to-purple-500' },
  lp:        { icon: LayoutGrid, iconBg: 'bg-gradient-to-br from-cyan-500 to-blue-500' },
  copy:      { icon: PenLine,  iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500' },
  movie:     { icon: Film,     iconBg: 'bg-gradient-to-br from-rose-500 to-pink-500' },
  interviewx: { icon: Send,    iconBg: 'bg-gradient-to-br from-indigo-500 to-violet-500' },
}

type ToolSwitcherMenuProps = {
  currentService: string // services.ts の id
  showLabel: boolean
  isCollapsed: boolean
  isMobile?: boolean
  className?: string
}

export function ToolSwitcherMenu({ currentService, showLabel, isCollapsed, className }: ToolSwitcherMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('up')
  const buttonRef = useRef<HTMLButtonElement>(null)

  // ボタン位置に基づいて展開方向を決定
  const detectDirection = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    // ボタンの中心がビューポートの上半分にあれば下に展開、下半分にあれば上に展開
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

  const activeServices = getActiveServices()
  const otherCount = activeServices.filter(s => s.id !== currentService).length

  const isUp = openDirection === 'up'
  const ChevronIcon = isUp ? ChevronUp : ChevronDown

  return (
    <div className={className || ''}>
      <div className="relative" ref={containerRef}>
        {/* メインボタン - 目立つグラデーション */}
        <button
          ref={buttonRef}
          onClick={handleToggle}
          className={`group w-full flex items-center gap-2 px-3 py-3 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all text-white ${
            !showLabel ? 'justify-center' : 'justify-between'
          }`}
          title="他のツールを使う"
          type="button"
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
              initial={{ opacity: 0, y: isUp ? -8 : 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: isUp ? -8 : 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={`absolute left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-[200] max-h-[calc(100vh-200px)] overflow-y-auto ${
                isUp ? 'bottom-full mb-2' : 'top-full mt-2'
              }`}
            >
              <div className="p-2 space-y-1">
                <p className="px-2 py-1 text-[10px] font-black text-gray-400 uppercase tracking-wider">ツール一覧</p>
                {activeServices.map((service) => {
                  const mapping = SERVICE_ICON_MAP[service.id]
                  if (!mapping) return null
                  const Icon = mapping.icon
                  const isCurrent = service.id === currentService
                  return isCurrent ? (
                    <div
                      key={service.id}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <div className={`w-8 h-8 rounded-lg ${mapping.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900">{service.name}</p>
                        <p className="text-[10px] font-bold text-slate-600">
                          {service.description}（現在使用中）
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Link
                      key={service.id}
                      href={service.dashboardHref}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                      onClick={() => setIsOpen(false)}
                    >
                      <div className={`w-8 h-8 rounded-lg ${mapping.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 group-hover:text-slate-900 transition-colors">{service.name}</p>
                        <p className="text-[10px] font-bold text-gray-500">{service.description}</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400" />
                    </Link>
                  )
                })}
              </div>
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 text-center">すべて同じアカウントで利用可能</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
