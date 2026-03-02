'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Globe, Layout, Sparkles, Palette, Download, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

const steps = [
  {
    icon: Globe,
    number: '01',
    title: '商品情報を入力',
    description: 'URLを貼り付けるだけで自動取得。または手動で商品名・説明・ターゲット・価格などを入力します。',
    tips: ['商品URLがあれば自動解析で情報を取得できます', '目的（リード獲得・販売・資料請求など）を複数選択できます', 'ターゲット層を具体的に入力すると精度が上がります'],
    color: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Layout,
    number: '02',
    title: '構成案を選択',
    description: 'AIが3パターンの構成案を提案します。目的に合った構成を選び、セクションの順序も調整できます。',
    tips: ['ストーリー重視・信頼重視・シンプルの3パターン', 'セクションの追加・削除・並び替えが可能です', '気に入らない場合は再生成もできます'],
    color: 'from-violet-500 to-purple-500',
  },
  {
    icon: Sparkles,
    number: '03',
    title: 'コピーを確認・編集',
    description: 'AIが各セクションのコピー（見出し・本文・CTA）を自動生成します。気に入らない箇所はブラッシュアップ指示で改善できます。',
    tips: ['各セクションのコピーが順次生成されます', '「もっとカジュアルに」など指示を出して再生成できます', '生成後も直接編集は随時対応予定'],
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: Palette,
    number: '04',
    title: 'デザインを選択',
    description: '8種類のデザインテーマから選択します。業種・雰囲気に合ったテーマで一瞬でプロ品質のLPが完成します。',
    tips: ['フリープランでは3テーマが利用可能', 'Corporate・Minimal・Warmはフリーで使えます', 'プロプランで全テーマ解放'],
    color: 'from-pink-500 to-rose-500',
  },
  {
    icon: Download,
    number: '05',
    title: 'HTMLをダウンロード',
    description: 'デザインが完成したらHTMLファイルをダウンロードできます。Tailwind CSSを使ったレスポンシブなLPが即座に使えます。',
    tips: ['CDN版Tailwindを使用、追加設定不要', 'Google Fontsを含んだ完全なHTMLファイル', 'そのままサーバーにアップロードして公開可能'],
    color: 'from-emerald-500 to-teal-500',
  },
]

const faqs = [
  { q: 'URLから情報を自動取得できますか？', a: '商品ページのURLを入力するとAIが自動解析して、商品名・説明・特徴などを取得します。ただしサイトの構造によっては精度が下がる場合があります。' },
  { q: '生成にどのくらい時間がかかりますか？', a: '構成案の生成に約10〜20秒、コピー生成に約20〜40秒（セクション数による）かかります。' },
  { q: 'PDFでの出力はできますか？', a: '現在はHTMLのみ対応しています。ブラウザの印刷機能からPDF保存は可能です。' },
  { q: 'ダウンロードしたHTMLはそのまま使えますか？', a: 'はい。Tailwind CSS CDNとGoogle Fontsを含んだ完全なHTMLファイルです。サーバーにアップロードするだけで公開できます。' },
  { q: 'フリープランでも使えますか？', a: 'フリープランでは1日3回までLP生成できます。テーマはCorporate・Minimal・Warmの3種類が利用可能です。' },
]

export default function LpGuidePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* ヘッダー */}
        <div className="mb-10">
          <h1 className="text-3xl font-black text-white mb-3">使い方ガイド</h1>
          <p className="text-slate-400">ドヤLP AIの使い方を5ステップで解説します。</p>
        </div>

        {/* ステップ */}
        <div className="space-y-6 mb-12">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs text-slate-600 font-bold font-mono">STEP {step.number}</span>
                      <h2 className="font-black text-white text-lg">{step.title}</h2>
                    </div>
                    <p className="text-slate-400 text-sm mb-4 leading-relaxed">{step.description}</p>
                    <div className="space-y-2">
                      {step.tips.map((tip, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-slate-400">{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* FAQ */}
        <div className="mb-12">
          <h2 className="text-xl font-black text-white mb-6">よくある質問</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5"
              >
                <p className="font-bold text-white mb-2 flex items-start gap-2">
                  <span className="text-cyan-400 font-black flex-shrink-0">Q.</span>
                  {faq.q}
                </p>
                <p className="text-slate-400 text-sm leading-relaxed pl-6">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border border-cyan-700/30 rounded-2xl p-8 text-center">
          <h3 className="text-xl font-black text-white mb-3">さっそく試してみましょう</h3>
          <p className="text-slate-400 text-sm mb-6">フリープランで今すぐ始められます。クレジットカード不要。</p>
          <button
            onClick={() => router.push('/lp/new/input')}
            className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-8 py-4 rounded-xl transition-colors"
          >
            LPを作成する
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
