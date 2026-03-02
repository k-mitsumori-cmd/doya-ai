'use client'

import { motion } from 'framer-motion'
import { Globe, Palette, Eye, Settings, Code2, Download } from 'lucide-react'

const STEPS = [
  { icon: Globe, title: 'URLを入力', desc: 'オープニングアニメーションを作りたいサイトのURLを入力してください。AIがサイトを解析します。' },
  { icon: Palette, title: 'カラー・ロゴ自動抽出', desc: 'AIがサイトのカラースキーム、ロゴ、テキスト、OGP情報を自動的に抽出します。' },
  { icon: Eye, title: 'テンプレートを選択', desc: '6種類のアニメーションテンプレートからお好みのものを選びます。クリックでフルスクリーンプレビュー。' },
  { icon: Settings, title: '微調整', desc: 'テキスト、カラー、タイミング、イージングなどをリアルタイムプレビューしながら調整。' },
  { icon: Code2, title: 'コードをコピー', desc: '生成されたReactコンポーネントをコピーして、あなたのプロジェクトに貼り付けるだけ。' },
  { icon: Download, title: 'ZIPダウンロード（PRO）', desc: 'プロプランならREADME.md、package.json付きでZIP一括ダウンロード可能。' },
]

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-black text-white mb-4">使い方ガイド</h1>
        <p className="text-white/50">ドヤオープニングAIの使い方を6ステップで解説</p>
      </div>

      <div className="space-y-8">
        {STEPS.map((step, i) => (
          <motion.div
            key={i}
            className="flex gap-6 p-6 rounded-xl border border-white/5 bg-white/5"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#EF4343]/10">
              <step.icon className="h-6 w-6 text-[#EF4343]" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#EF4343]/60 uppercase tracking-widest mb-1">Step {i + 1}</p>
              <h3 className="text-lg font-bold text-white mb-1">{step.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
