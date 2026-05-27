'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface UpgradeBannerProps {
  /** Current usage count */
  used: number
  /** Plan limit */
  limit: number
  /** Resource label (e.g., '従業員数', '1on1', '評価') */
  label: string
  /** Show threshold — banner appears when usage >= threshold% (default 80) */
  threshold?: number
}

export default function UpgradeBanner({
  used,
  limit,
  label,
  threshold = 80,
}: UpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (limit <= 0) return null
  const pct = Math.round((used / limit) * 100)
  const shouldShow = pct >= threshold && !dismissed

  const isCritical = pct >= 95

  return (
    <AnimatePresence>
      {shouldShow && <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        className={`mb-6 p-4 rounded-2xl flex items-center gap-4 relative overflow-hidden ${
          isCritical
            ? 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-200'
            : 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200'
        }`}
      >
        {/* Animated icon */}
        <motion.img
          src={isCritical ? '/hr/characters/surprise_驚き.png' : '/hr/characters/point_解説.png'}
          alt="白くまキャラクター"
          className="w-12 flex-shrink-0"
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
            <span className="material-symbols-outlined text-sm align-middle mr-1">
              {isCritical ? 'error' : 'warning'}
            </span>
            {label}が上限の{pct}%に達しています
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {used} / {limit} 使用中 -- アップグレードで上限を拡張できます
          </p>
        </div>

        {/* Usage bar mini */}
        <div className="hidden sm:block w-24 flex-shrink-0">
          <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                isCritical
                  ? 'bg-gradient-to-r from-red-400 to-red-500'
                  : 'bg-gradient-to-r from-amber-400 to-amber-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/hr/settings/billing"
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all ${
            isCritical
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-amber-500 text-white hover:bg-amber-600'
          }`}
        >
          <span className="material-symbols-outlined text-sm align-middle mr-1">upgrade</span>
          アップグレード
        </Link>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="閉じる"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </motion.div>}
    </AnimatePresence>
  )
}
