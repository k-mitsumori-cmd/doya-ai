'use client'

import { motion } from 'framer-motion'
import type { SidebarTheme } from './types'

export function SidebarShell({
  isCollapsed,
  isMobile,
  theme,
  children,
}: {
  isCollapsed: boolean
  isMobile?: boolean
  theme: SidebarTheme
  children: React.ReactNode
}) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={`${isMobile ? 'relative' : 'fixed left-0 top-0'} h-screen ${theme.bgGradient} flex flex-col z-50 shadow-xl`}
    >
      {children}
    </motion.aside>
  )
}
