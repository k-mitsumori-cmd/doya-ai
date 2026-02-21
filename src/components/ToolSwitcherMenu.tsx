'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ExternalLink,
  FileText,
  Image,
  LayoutGrid,
  Mic,
  Target,
  Activity,
  Sparkles,
  Palette,
  Play,
  type LucideIcon,
} from 'lucide-react'
import { getActiveServices } from '@/lib/services'

// services.ts の id → lucide アイコン & グラデーション
const SERVICE_ICON_MAP: Record<string, { icon: LucideIcon; iconBg: string }> = {
  kantan:    { icon: Sparkles, iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500' },
  banner:    { icon: Image,    iconBg: 'bg-gradient-to-br from-purple-500 to-pink-500' },
  logo:      { icon: Palette,  iconBg: 'bg-gradient-to-br from-indigo-500 to-sky-500' },
  seo:       { icon: FileText, iconBg: 'bg-gradient-to-br from-slate-700 to-slate-900' },
  interview: { icon: Mic,      iconBg: 'bg-gradient-to-br from-orange-500 to-amber-500' },
  shindan:   { icon: Activity, iconBg: 'bg-gradient-to-br from-teal-500 to-cyan-500' },
  opening:   { icon: Play,     iconBg: 'bg-gradient-to-br from-red-500 to-rose-600' },
  persona:   { icon: Target,   iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600' },
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

  const activeServices = getActiveServices()

  return (
    <div className={className || ''}>
      <div className="relative">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/20 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 transition-all text-white ${
            !showLabel && !isCollapsed ? 'justify-center' : !showLabel ? 'justify-center' : 'justify-between'
          }`}
          title="他のツールを使う"
          type="button"
        >
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 sm:w-4 sm:h-4 text-white flex-shrink-0" />
            <AnimatePresence>
              {showLabel && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  className="text-sm sm:text-xs font-bold"
                >
                  他のツールを使う
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {showLabel && (
            <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>

        {/* ドロップダウンメニュー */}
        <AnimatePresence>
          {isOpen && showLabel && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-[200] max-h-[calc(100vh-200px)] overflow-y-auto"
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
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-black text-slate-900">{service.name}</p>
                        </div>
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
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-black text-gray-900 group-hover:text-slate-900 transition-colors">{service.name}</p>
                        </div>
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
