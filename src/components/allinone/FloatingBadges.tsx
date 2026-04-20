'use client'

import { motion } from 'framer-motion'
import {
  BarChart3,
  Target,
  Search,
  Palette,
  Image as ImageIcon,
  MessageSquare,
  LayoutGrid,
  Lightbulb,
} from 'lucide-react'

const BADGES = [
  { label: 'サイト診断', icon: BarChart3, color: 'from-violet-500 to-fuchsia-500', top: '2%', left: '2%', delay: 0 },
  { label: 'SEO分析', icon: Search, color: 'from-cyan-500 to-blue-500', top: '18%', right: '0%', delay: 0.15 },
  { label: 'ペルソナ', icon: Target, color: 'from-pink-500 to-rose-500', top: '50%', left: '-4%', delay: 0.3 },
  { label: 'キービジュアル', icon: ImageIcon, color: 'from-amber-500 to-orange-500', top: '65%', right: '-3%', delay: 0.45 },
  { label: 'ブランド診断', icon: Palette, color: 'from-emerald-500 to-teal-500', top: '82%', left: '4%', delay: 0.6 },
  { label: 'AIチャット', icon: MessageSquare, color: 'from-blue-500 to-indigo-500', top: '90%', right: '6%', delay: 0.75 },
]

export function FloatingBadges() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-0 hidden md:block">
      {BADGES.map((b, i) => {
        const Icon = b.icon
        const even = i % 2 === 0
        return (
          <motion.div
            key={b.label}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 + b.delay }}
            style={{
              position: 'absolute',
              top: b.top,
              left: b.left,
              right: b.right,
            }}
          >
            <motion.div
              animate={{
                y: [0, even ? -12 : 12, 0],
                rotate: [0, even ? 2 : -2, 0],
              }}
              transition={{
                duration: 5 + i * 0.4,
                ease: 'easeInOut',
                repeat: Infinity,
              }}
              className="flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-2 text-xs font-black text-allinone-ink shadow-lg backdrop-blur"
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br ${b.color} text-white`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              {b.label}
            </motion.div>
          </motion.div>
        )
      })}
    </div>
  )
}
