import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '使い方ガイド | ドヤボイスAI',
}

const STEPS = [
  {
    step: '01',
    title: 'テキストを入力',
    description: '読み上げたいテキストを入力します。**太字**は強調、...は間として自動的にSSMLに変換されます。',
    icon: '✏️',
  },
  {
    step: '02',
    title: 'ボイスキャラクターを選択',
    description: '12種類のキャラクターから最適な声を選びます。無料プランはアキラ・サクラ・ハルト・ミサキの4種が利用可能です。',
    icon: '🎭',
  },
  {
    step: '03',
    title: '感情トーンと詳細設定',
    description: 'ニュートラル・明るい・落ち着き・真剣・やさしいの5種類の感情トーンを選択。話速・ピッチ・音量も細かく調整できます。',
    icon: '🎛️',
  },
  {
    step: '04',
    title: '音声を生成',
    description: '「音声を生成する」ボタンをクリック。約3〜5秒で自然な日本語ナレーションが生成されます。',
    icon: '🎙️',
  },
  {
    step: '05',
    title: 'プレビュー・ダウンロード',
    description: 'ブラウザ上でプレビュー再生。MP3/WAV/OGG/M4A形式でダウンロードできます（Proプランで全形式対応）。',
    icon: '⬇️',
  },
]

const TIPS = [
  {
    title: '自然な間を入れるコツ',
    content: '句読点（、。）の後に自動的に間が挿入されます。詳細設定で「間の長さ」を「長い」に変更すると、よりゆっくりとした印象になります。',
  },
  {
    title: '強調したい部分は太字に',
    content: '重要な単語を **単語** のように囲むと、SSML の <emphasis> タグとして認識され、強調して読み上げます。',
  },
  {
    title: '長文は改行で区切る',
    content: '1,000文字を超える場合は段落ごとに改行を入れると、より自然な読み上げになります。',
  },
  {
    title: 'バッチ生成でまとめて作成',
    content: 'Proプランでは複数テキストを改行区切りで入力し、一括生成できます。e-Learningのチャプターやよくある質問の回答音声をまとめて作成できます。',
  },
]

export default function GuidePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-black text-slate-900">使い方ガイド</h1>
        <p className="text-slate-500 mt-2">ドヤボイスAIの基本的な使い方をご説明します</p>
      </div>

      {/* ステップ */}
      <div>
        <h2 className="text-xl font-black text-slate-900 mb-6">基本的な使い方</h2>
        <div className="space-y-4">
          {STEPS.map(step => (
            <div key={step.step} className="flex gap-4 p-5 bg-white rounded-2xl border border-slate-200">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center text-2xl">
                {step.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">STEP {step.step}</span>
                  <h3 className="font-black text-slate-900">{step.title}</h3>
                </div>
                <p className="text-sm text-slate-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div>
        <h2 className="text-xl font-black text-slate-900 mb-6">活用Tips</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TIPS.map(tip => (
            <div key={tip.title} className="p-5 bg-violet-50 rounded-2xl border border-violet-100">
              <h3 className="font-black text-violet-900 mb-2">💡 {tip.title}</h3>
              <p className="text-sm text-violet-700">{tip.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center py-8">
        <Link
          href="/voice/new"
          className="inline-flex items-center gap-2 px-8 py-4 bg-violet-600 text-white rounded-2xl font-black text-lg hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25"
        >
          🎙️ さっそく試してみる
        </Link>
      </div>
    </div>
  )
}
