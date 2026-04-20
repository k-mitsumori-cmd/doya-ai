'use client'

import { motion } from 'framer-motion'
import { Clock3, Shield, Sparkles, Zap } from 'lucide-react'

const ITEMS = [
  { icon: Zap, label: '15秒で完了', sub: 'URL 1本 → ダッシュボード' },
  { icon: Sparkles, label: '6タブで横断', sub: 'サイト / SEO / ペルソナ / 他' },
  { icon: Clock3, label: '毎月更新', sub: '何度でも再分析 OK' },
  { icon: Shield, label: '認証不要', sub: 'ゲストも月3回無料' },
]

export function SocialProof() {
  return (
    <section className="relative border-y border-allinone-line/70 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-6 px-4 py-8 sm:grid-cols-4 sm:px-6">
        {ITEMS.map((item, i) => {
          const Icon = item.icon
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flex items-center gap-3"
            >
              <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-allinone-primarySoft text-allinone-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-black text-allinone-ink">{item.label}</div>
                <div className="text-xs text-allinone-muted">{item.sub}</div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
