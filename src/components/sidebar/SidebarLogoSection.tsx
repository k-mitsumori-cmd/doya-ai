'use client'

import { motion, AnimatePresence } from 'framer-motion'

export function SidebarLogoSection({
  icon: Icon,
  title,
  subtitle,
  subtitleClassName,
  showLabel,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  subtitleClassName?: string
  showLabel: boolean
}) {
  return (
    <div className="px-3 sm:px-4 py-4 sm:py-5 flex items-center gap-2">
      <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm backdrop-blur-md">
        <Icon className="w-5 h-5 sm:w-5 sm:h-5 text-white" />
      </div>
      <AnimatePresence>
        {showLabel && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="overflow-hidden"
          >
            <h1 className="text-xl sm:text-lg font-black text-white tracking-tighter leading-none">{title}</h1>
            {subtitle && (
              <p className={`text-[10px] font-bold mt-0.5 ${subtitleClassName || 'text-white/70'}`}>{subtitle}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
