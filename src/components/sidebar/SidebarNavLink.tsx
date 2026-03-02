'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { NavItem, SidebarTheme } from './types'

export function SidebarNavLink({
  item,
  isActive,
  showLabel,
  theme,
  layoutId,
  dataTourNav,
}: {
  item: NavItem
  isActive: boolean
  showLabel: boolean
  theme: SidebarTheme
  layoutId: string
  dataTourNav?: string
}) {
  const Icon = item.icon

  return (
    <Link href={item.href}>
      <motion.div
        whileHover={{ x: 4 }}
        data-tour-nav={dataTourNav}
        className={`relative flex items-center gap-3 px-3 py-3.5 sm:py-2.5 rounded-xl transition-all cursor-pointer group ${
          isActive
            ? 'bg-white/15 text-white'
            : `${theme.navText} hover:text-white hover:bg-white/10`
        }`}
      >
        <Icon className={`w-6 h-6 sm:w-5 sm:h-5 flex-shrink-0 ${isActive ? 'text-white' : `${theme.navTextIcon} group-hover:text-white`}`} />

        <AnimatePresence>
          {showLabel && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="text-base sm:text-sm font-bold sm:font-medium whitespace-nowrap overflow-hidden"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {item.hot && showLabel && (
          <span className="ml-auto px-2 py-1 sm:px-1.5 sm:py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-xs sm:text-[10px] font-bold text-white rounded-md shadow-sm">
            HOT
          </span>
        )}

        {item.badge && showLabel && (
          <span className="ml-auto px-2.5 py-1 sm:px-2 sm:py-0.5 bg-white/20 text-xs sm:text-[10px] font-bold rounded-full">
            {item.badge}
          </span>
        )}

        {isActive && (
          <motion.div
            layoutId={layoutId}
            className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full"
          />
        )}
      </motion.div>
    </Link>
  )
}
