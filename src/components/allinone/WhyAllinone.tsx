'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'

export function WhyAllinone() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-black tracking-tight text-allinone-ink sm:text-5xl">
            なぜ、
            <span className="bg-gradient-to-r from-allinone-primary to-allinone-cyan bg-clip-text text-transparent">オールインワン</span>
            である必要があるのか。
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-allinone-muted sm:text-base">
            別々に10ツール触るより、1画面で全部。それが最も生産性が高い。
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl border border-allinone-line bg-allinone-surface p-8"
          >
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black text-allinone-muted">
              BEFORE
            </div>
            <h3 className="text-2xl font-black text-allinone-ink">バラバラに分析していた頃</h3>
            <ul className="mt-6 space-y-3 text-sm text-allinone-inkSoft">
              {[
                'PageSpeed / Google Search Console / 競合ツール…を別々に開く',
                '社内会議資料のためだけに、スクショ集計に半日',
                'SEO・ペルソナ・バナーを別の会社に発注していた',
                '「次に何をすべきか」は最後まで曖昧なまま',
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 flex-none text-allinone-danger" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative overflow-hidden rounded-3xl border border-allinone-primary/30 bg-gradient-to-br from-allinone-primarySoft via-white to-cyan-50 p-8 shadow-xl shadow-allinone-primary/10"
          >
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black text-allinone-primary">
              AFTER
            </div>
            <h3 className="text-2xl font-black text-allinone-ink">ドヤマーケAI を使うと</h3>
            <ul className="mt-6 space-y-3 text-sm text-allinone-inkSoft">
              {[
                'URL 1本で 5軸分析が15秒で完了。スクショ不要。',
                '「最優先TOP3」がすぐ決まる。資料は PDF/PPTX 即出力。',
                '記事・バナー・広告はワンクリックで各ドヤAIへ連携。',
                'AIチャットで深掘り・修正を対話的に。',
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-allinone-accent" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <span className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-allinone-primary/10 blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
