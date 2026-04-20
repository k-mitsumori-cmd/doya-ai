'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Presentation, Sparkles, Zap, SlidersHorizontal, Users, Briefcase, Video, FileText } from 'lucide-react'

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }

export default function SlashSlideLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white overflow-hidden">
      {/* Hero */}
      <section className="relative pt-24 pb-20 px-6">
        {/* decorative blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-indigo-500/20 blur-[120px]" />
          <div className="absolute top-1/2 -left-60 w-[500px] h-[500px] rounded-full bg-fuchsia-500/15 blur-[100px]" />
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.12 }}
          className="relative max-w-4xl mx-auto text-center"
        >
          <motion.p
            variants={fadeUp}
            className="text-sm font-semibold tracking-widest text-indigo-300 uppercase mb-4"
          >
            Powered by Gemini AI
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-6xl font-black tracking-tight leading-tight"
          >
            スライド資料が{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-pink-400">
              一瞬で完成
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 text-lg md:text-xl text-slate-300 max-w-2xl mx-auto"
          >
            提案資料・営業資料・ミーティングの叩き台・採用資料まで、AIが自動で構成＆デザイン。
            あなたはGoogleスライドで仕上げるだけ。
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex justify-center gap-4 flex-wrap">
            <Link
              href="/slashslide/create"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 shadow-lg shadow-indigo-500/30 transition"
            >
              <Sparkles className="w-5 h-5" />
              無料でスライドを作成
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Use cases */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            こんな資料が<span className="text-indigo-400">すぐに</span>作れます
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((uc, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -6 }}
                className="relative p-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 text-center group"
              >
                <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30 group-hover:from-indigo-400/40 group-hover:to-fuchsia-400/40 transition">
                  <uc.icon className="w-7 h-7 text-indigo-300" />
                </div>
                <h3 className="text-lg font-semibold">{uc.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{uc.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-gradient-to-t from-slate-900 to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">使い方はシンプル</h2>
          <p className="text-slate-400 mb-12">3ステップで完成</p>

          <div className="flex flex-col md:flex-row gap-8">
            {steps.map((step, i) => (
              <div key={i} className="flex-1 relative">
                <div className="text-6xl font-black text-indigo-500/20 absolute -top-4 left-1/2 -translate-x-1/2 select-none">
                  {i + 1}
                </div>
                <div className="pt-10">
                  <step.icon className="w-8 h-8 mx-auto text-indigo-400 mb-3" />
                  <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                  <p className="text-sm text-slate-400">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">まずは無料で試す</h2>
          <p className="text-slate-400 mb-8">
            登録不要・クレカ不要ですぐに使えます。
          </p>
          <Link
            href="/slashslide/create"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-full font-bold text-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 shadow-lg shadow-indigo-500/30 transition"
          >
            <Zap className="w-5 h-5" />
            スライドを作成する
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-slate-500 text-sm">
        &copy; {new Date().getFullYear()} SlashSlide — ドヤAIシリーズ
      </footer>
    </div>
  )
}

const useCases = [
  { icon: Briefcase, title: '提案資料', desc: '案件に合わせた構成をAIが提案' },
  { icon: Users, title: '採用資料', desc: '企業の魅力が伝わる採用デッキ' },
  { icon: Video, title: 'ウェビナー', desc: 'セミナー資料も一発で下書き' },
  { icon: FileText, title: '議事メモ', desc: 'ミーティング用スライドを即生成' },
]

const steps = [
  { icon: SlidersHorizontal, title: 'テーマ入力', desc: '資料の目的とトピックを入力' },
  { icon: Sparkles, title: 'AI生成', desc: 'GeminiがスライドをJSON構成' },
  { icon: Presentation, title: 'Google Slides', desc: 'ワンクリックでスライドに変換' },
]




