'use client'

import { HelpCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'

export function SidebarHelpContact({
  showLabel,
  isCollapsed,
  isMobile,
}: {
  showLabel: boolean
  isCollapsed: boolean
  isMobile?: boolean
}) {
  return (
    <div className="px-3 sm:px-4 pb-2">
      <a
        href={SUPPORT_CONTACT_URL}
        target="_blank"
        rel="noreferrer"
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 transition-colors text-white ${
          !isMobile && isCollapsed ? 'justify-center' : ''
        }`}
      >
        <HelpCircle className="w-5 h-5 sm:w-4 sm:h-4 text-white flex-shrink-0" />
        <AnimatePresence>
          {showLabel && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              className="min-w-0"
            >
              <div className="text-sm sm:text-xs font-bold leading-none">お問い合わせ</div>
            </motion.div>
          )}
        </AnimatePresence>
      </a>
    </div>
  )
}
