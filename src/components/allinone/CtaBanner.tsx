'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'

export function CtaBanner() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-allinone-ink via-allinone-inkSoft to-allinone-primaryDeep p-10 text-white sm:p-14"
        >
          {/* ドットパターン */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black">
              <Sparkles className="h-3 w-3" />
              URL 1本で、今すぐ体験
            </div>
            <h2 className="text-3xl font-black tracking-tight sm:text-5xl">
              あなたのサイトに、
              <br />
              何が足りないか、見せます。
            </h2>
            <p className="mt-4 max-w-xl text-sm text-white/70 sm:text-base">
              ユーザー登録も不要。月3回まで完全無料。
            </p>
            <Link
              href="/allinone#top"
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-allinone-ink transition hover:-translate-y-0.5 hover:shadow-2xl sm:text-base"
            >
              さっそく分析を始める
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
          {/* 光の円 */}
          <span className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-allinone-primary/30 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-allinone-cyan/30 blur-3xl" />
        </motion.div>
      </div>
    </section>
  )
}
