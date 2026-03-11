import Link from 'next/link'
import type { Metadata } from 'next'
import {
  FileText,
  Users,
  SlidersHorizontal,
  Sparkles,
  Download,
  MessageCircle,
  Bold,
  CornerDownLeft,
  Crown,
  Mic,
} from 'lucide-react'

export const metadata: Metadata = {
  title: '使い方ガイド | ドヤボイスAI',
}

const STEPS = [
  {
    step: '01',
    title: 'テキストを入力',
    description: '読み上げたいテキストを入力します。**太字**は強調、...は間として自動的にSSMLに変換されます。',
    icon: FileText,
  },
  {
    step: '02',
    title: 'ボイスキャラクターを選択',
    description: '12種類のキャラクターから最適な声を選びます。無料プランはアキラ・サクラ・ハルト・ミサキの4種が利用可能です。',
    icon: Users,
  },
  {
    step: '03',
    title: '感情トーンと詳細設定',
    description: 'ニュートラル・明るい・落ち着き・真剣・やさしいの5種類の感情トーンを選択。話速・ピッチ・音量も細かく調整できます。',
    icon: SlidersHorizontal,
  },
  {
    step: '04',
    title: '音声を生成',
    description: '「音声を生成する」ボタンをクリック。約3〜5秒で自然な日本語ナレーションが生成されます。',
    icon: Sparkles,
  },
  {
    step: '05',
    title: 'プレビュー・ダウンロード',
    description: 'ブラウザ上でプレビュー再生。MP3/WAV/OGG/M4A形式でダウンロードできます（Proプランで全形式対応）。',
    icon: Download,
  },
]

const TIPS = [
  {
    title: '自然な間を入れるコツ',
    content: '句読点（、。）の後に自動的に間が挿入されます。詳細設定で「間の長さ」を「長い」に変更すると、よりゆっくりとした印象になります。',
    icon: MessageCircle,
  },
  {
    title: '強調したい部分は太字に',
    content: '重要な単語を **単語** のように囲むと、SSMLの強調タグとして認識され、強調して読み上げます。',
    icon: Bold,
  },
  {
    title: '長文は改行で区切る',
    content: '1,000文字を超える場合は段落ごとに改行を入れると、より自然な読み上げになります。',
    icon: CornerDownLeft,
  },
  {
    title: 'Proプランで全キャラクター利用',
    content: 'Proプランでは12種類すべてのボイスキャラクターが利用可能。Wavenet高品質音声やWAV/OGG/M4A形式でのダウンロードにも対応しています。',
    icon: Crown,
  },
]

export default function GuidePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Page title */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-black text-slate-900">使い方ガイド</h1>
        <p className="text-lg text-slate-500 mt-3">ドヤボイスAIの基本的な使い方をご説明します</p>
      </div>

      {/* Steps section */}
      <div className="mb-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1.5 h-8 bg-violet-600 rounded-full"></div>
          <h2 className="text-2xl font-black text-slate-900">基本的な使い方</h2>
        </div>

        <div className="relative space-y-12">
          {/* Vertical connector line */}
          <div className="absolute left-[27px] top-8 bottom-8 w-[2px] bg-violet-600/10 hidden sm:block" />

          {STEPS.map((step) => (
            <div key={step.step} className="relative flex gap-5">
              <div className="relative z-10 flex-shrink-0 size-14 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center">
                <step.icon className="w-6 h-6" />
              </div>
              <div className="pt-1">
                <span className="inline-block px-3 py-1 bg-violet-600 text-white text-[10px] font-bold rounded-full mb-2 tracking-widest uppercase">
                  STEP {step.step}
                </span>
                <h3 className="text-xl font-black text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips section */}
      <div className="mb-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1.5 h-8 bg-violet-600 rounded-full"></div>
          <h2 className="text-2xl font-black text-slate-900">活用Tips</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TIPS.map((tip) => (
            <div key={tip.title} className="bg-violet-50 p-6 rounded-2xl flex gap-4">
              <div className="flex-shrink-0 text-violet-600 mt-0.5">
                <tip.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">{tip.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{tip.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA section */}
      <div className="p-12 rounded-2xl bg-slate-900 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(124,59,237,0.3),transparent)] pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-white mb-3">さっそく試してみましょう</h2>
          <p className="text-slate-300 mb-8">テキストを入力するだけで、プロ品質のナレーションが完成します</p>
          <Link
            href="/voice/new"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-xl font-bold py-5 px-10 rounded-xl shadow-xl shadow-violet-600/40 transition-colors"
          >
            <Mic className="w-6 h-6" />
            音声を生成する
          </Link>
        </div>
      </div>
    </div>
  )
}
