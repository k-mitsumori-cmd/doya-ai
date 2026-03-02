'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { SidebarTheme } from './types'

export function SidebarSectionTitle({
  title,
  isCollapsed,
  theme,
}: {
  title: string
  isCollapsed: boolean
  theme: SidebarTheme
}) {
  return (
    <AnimatePresence>
      {!isCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`px-3 py-2 text-[10px] font-bold ${theme.sectionText} uppercase tracking-wider`}
        >
          {title}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
