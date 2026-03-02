'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { SidebarTheme } from './types'

export function SidebarBrandingFooter({
  brandName,
  isCollapsed,
  theme,
}: {
  brandName: string
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
          className="px-4 py-4 text-center border-t border-white/5"
        >
          <p className={`text-[10px] ${theme.brandingText} font-bold tracking-widest`}>{brandName}</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
