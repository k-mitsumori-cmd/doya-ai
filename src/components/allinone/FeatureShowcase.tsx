'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  BarChart3,
  Search,
  Target,
  Palette,
  Sparkles,
  ListChecks,
  MessagesSquare,
  FileDown,
  ArrowRight,
} from 'lucide-react'

const FEATURES = [
  {
    icon: BarChart3,
    title: 'サイト診断',
    desc: 'PageSpeed・構造化データ・メタタグ・第一印象まで全部採点。',
    hue: 'from-violet-500 to-fuchsia-500',
  },
  {
    icon: Search,
    title: 'SEO 分析',
    desc: '不足キーワードと「作るべき記事テーマ」を具体的に提案。',
    hue: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Target,
    title: 'ペルソナ自動生成',
    desc: '3名の代表ペルソナを肖像画像つきで自動設計。',
    hue: 'from-pink-500 to-rose-500',
  },
  {
    icon: Palette,
    title: 'ブランド分析',
    desc: 'トーン・パレット・フォントから一貫性スコアを評価。',
    hue: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Sparkles,
    title: 'キービジュアル3案',
    desc: '王道・攻め・ミニマル、広告即使える3案を AI が生成。',
    hue: 'from-amber-500 to-orange-500',
  },
  {
    icon: ListChecks,
    title: 'アクションプラン',
    desc: '優先度・工数・日数つき、10件のやるべきこと。',
    hue: 'from-indigo-500 to-blue-600',
  },
  {
    icon: MessagesSquare,
    title: 'AIチャット',
    desc: '診断結果を使って深掘り・修正・冗長な改善案を対話で。',
    hue: 'from-blue-500 to-indigo-500',
  },
  {
    icon: FileDown,
    title: 'PDF/PPTX/Excel 出力',
    desc: 'クライアント提出そのままの資料に変換。',
    hue: 'from-slate-700 to-slate-900',
  },
]

export function FeatureShowcase() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-allinone-primarySoft px-3 py-1 text-xs font-black text-allinone-primary">
            <Sparkles className="h-3 w-3" />
            OVERVIEW
          </div>
          <h2 className="text-3xl font-black tracking-tight text-allinone-ink sm:text-5xl">
            8つの分析が、
            <br />
            <span className="bg-gradient-to-r from-allinone-primary to-allinone-cyan bg-clip-text text-transparent">
              1 画面に集約される。
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-allinone-muted sm:text-base">
            「何が足りないか」「次に何をすべきか」を、AI が並列に解析。
            資料作成や提案書の叩き台もそのまま。
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="group relative overflow-hidden rounded-3xl border border-allinone-line bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-allinone-primary/10"
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${f.hue} text-white shadow-lg shadow-black/10 transition group-hover:scale-110 group-hover:rotate-3`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-black text-allinone-ink">{f.title}</h3>
                <p className="mt-2 text-sm text-allinone-inkSoft">{f.desc}</p>
                <span className="pointer-events-none absolute inset-x-0 -bottom-10 h-20 bg-gradient-to-t from-allinone-primarySoft/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-10 text-center"
        >
          <Link
            href="#top"
            className="inline-flex items-center gap-2 rounded-full border border-allinone-line bg-white px-5 py-2.5 text-sm font-black text-allinone-ink transition hover:-translate-y-0.5 hover:border-allinone-primary hover:text-allinone-primary hover:shadow-lg"
          >
            さっそくURLを入力する
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
