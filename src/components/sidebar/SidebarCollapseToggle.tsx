'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SidebarTheme } from './types'

export function SidebarCollapseToggle({
  isCollapsed,
  onToggle,
  isMobile,
  theme,
}: {
  isCollapsed: boolean
  onToggle: () => void
  isMobile?: boolean
  theme: SidebarTheme
}) {
  if (isMobile) return null

  return (
    <button
      onClick={onToggle}
      className={`absolute -right-3 top-24 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center ${theme.toggleText} ${theme.toggleHover} transition-colors border border-gray-100 z-10`}
    >
      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
    </button>
  )
}
