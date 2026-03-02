'use client'
// ============================================
// ドヤムービーAI - 使い方ガイド
// ============================================
import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

const STEPS = [
  {
    number: '01',
    title: '商品情報を入力',
    icon: '📝',
    desc: '商品名・URL・特徴・ターゲットを入力します。URLを入れると自動解析も可能です。',
    details: [
      '商品URLを入れると内容を自動取得',
      '特徴は1行1つで入力',
      '業種・ターゲット・USPで精度向上',
      '配信先・尺・アスペクト比を選択',
    ],
  },
  {
    number: '02',
    title: 'ペルソナを設定',
    icon: '👤',
    desc: 'ターゲット視聴者のペルソナを設定。スキップもできます。設定すると企画の精度が上がります。',
    details: [
      'ドヤペルソナAIからインポート可能',
      '年齢・性別・職業・悩みを入力',
      'AIによる自動生成も利用可能',
      'スキップしてもOK',
    ],
  },
  {
    number: '03',
    title: '企画をAIが生成',
    icon: '🤖',
    desc: 'AIが3パターンの動画企画をリアルタイムで生成します。コンセプト・ストーリー・シーン構成が含まれます。',
    details: [
      '3パターンがリアルタイム表示',
      '起承転結のストーリーライン',
      'シーン数・BGM・ナレーションスタイル',
      '気に入らない場合は再生成',
    ],
  },
  {
    number: '04',
    title: '編集・ダウンロード',
    icon: '✏️',
    desc: 'テキスト・背景・BGMを自由に編集してレンダリング。MP4またはGIFでダウンロードできます。',
    details: [
      'シーン別にテキスト・背景を編集',
      'アニメーション・トランジション設定',
      'BGM選択（Free: 3種 / Pro: 全12種）',
      'MP4/GIF形式でダウンロード',
    ],
  },
]

const FAQS = [
  {
    q: '無料で何本まで作れますか？',
    a: '無料プランでは月3本まで作成できます。4本目からはProプラン（¥9,980/月）が必要です。',
  },
  {
    q: 'ナレーション音声は自動生成されますか？',
    a: '現在のバージョンではナレーションテキストの入力に対応しています。音声合成機能は今後追加予定です。',
  },
  {
    q: '生成した動画は商用利用できますか？',
    a: 'はい、生成した動画は商用利用できます。ただし、使用した背景画像・BGMのライセンスに従ってください。',
  },
  {
    q: 'どのプラットフォームに対応していますか？',
    a: 'YouTube・YouTube Shorts・Instagram・TikTok・X（Twitter）・Facebook・LINEなど9種類のプラットフォームに対応しています。',
  },
  {
    q: '動画の保存期間はどのくらいですか？',
    a: '無料プランは7日間、Proプランは無期限で保存されます。',
  },
  {
    q: 'ウォーターマーク（透かし）は入りますか？',
    a: '無料プランでは「ドヤムービーAI」のウォーターマークが入ります。Proプランでは非表示にできます。',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-rose-900/30 last:border-none">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left py-4 flex items-start justify-between gap-3 hover:text-rose-200 transition-colors"
      >
        <span className="text-white text-sm font-semibold">{q}</span>
        <span className="material-symbols-outlined text-rose-400 flex-shrink-0 text-lg">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-rose-200/60 text-sm pb-4 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function GuidePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white mb-2">使い方ガイド</h1>
        <p className="text-rose-200/60 text-sm">ドヤムービーAIの使い方をご説明します。</p>
      </div>

      {/* ステップガイド */}
      <section className="mb-12">
        <h2 className="text-white font-bold text-lg mb-6">4ステップで動画完成</h2>
        <div className="space-y-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="flex gap-5 rounded-xl border border-rose-900/30 bg-slate-900/50 p-5"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/30 to-pink-500/20 flex items-center justify-center border border-rose-500/30">
                  <span className="text-2xl">{step.icon}</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-rose-400/60 text-xs font-black">STEP {step.number}</span>
                </div>
                <h3 className="text-white font-bold mb-1">{step.title}</h3>
                <p className="text-rose-200/60 text-sm mb-3">{step.desc}</p>
                <ul className="space-y-1">
                  {step.details.map((d, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-rose-200/50">
                      <span className="text-rose-500 mt-0.5 flex-shrink-0">✓</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 機能説明 */}
      <section className="mb-12">
        <h2 className="text-white font-bold text-lg mb-4">主な機能</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { icon: '🎬', title: 'AI企画生成', desc: '3パターンの動画企画を自動生成。ストーリーライン・シーン構成付き。' },
            { icon: '🖼️', title: 'テンプレート', desc: '業種別・目的別の15種類以上のテンプレートから選択可能。' },
            { icon: '✏️', title: 'ビジュアルエディタ', desc: 'テキスト・背景・アニメーションをリアルタイムで編集。' },
            { icon: '🎵', title: 'BGMライブラリ', desc: 'Free: 3種類、Pro: 12種類のロイヤリティフリーBGM。' },
            { icon: '📱', title: 'マルチフォーマット', desc: '16:9・9:16・1:1など複数のアスペクト比に対応。' },
            { icon: '⬇️', title: 'MP4/GIF出力', desc: 'MP4またはGIF形式でダウンロード可能。' },
          ].map((f, i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-rose-900/30 bg-slate-900/40 p-4">
              <span className="text-2xl flex-shrink-0">{f.icon}</span>
              <div>
                <h3 className="text-white font-semibold text-sm mb-0.5">{f.title}</h3>
                <p className="text-rose-200/50 text-xs">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="text-white font-bold text-lg mb-4">よくある質問</h2>
        <div className="rounded-xl border border-rose-900/30 bg-slate-900/40 px-5">
          {FAQS.map((faq, i) => (
            <FaqItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-6 text-center">
        <h2 className="text-white font-black text-xl mb-2">さっそく動画を作ってみる</h2>
        <p className="text-rose-200/60 text-sm mb-4">月3本まで無料。登録不要ですぐ始められます。</p>
        <Link
          href="/movie/new/concept"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
        >
          <span className="material-symbols-outlined">add_circle</span>
          無料で動画を作る
        </Link>
      </div>
    </div>
  )
}
