'use client'

import Link from 'next/link'
import { BookOpen, ChevronRight, PenLine, Sparkles, BarChart3, RefreshCw, Download } from 'lucide-react'

const STEPS = [
  {
    step: '01',
    title: '商品URLを入力',
    desc: '広告を出稿したい商品・サービスのURLを入力。AIが自動でページを解析し、商品名・ベネフィット・ターゲット層を抽出します。',
    icon: PenLine,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    step: '02',
    title: 'ペルソナを設定・確認',
    desc: 'AIが自動生成したターゲットペルソナを確認・編集。悩み・欲求・購買トリガーを正確に設定することで、刺さるコピーが生まれます。',
    icon: Sparkles,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    step: '03',
    title: '生成設定を選択',
    desc: '広告タイプ（ディスプレイ/検索/SNS）、ライタータイプ、訴求目的を選択。レギュレーション（NGワード・文字数制限）も設定できます。',
    icon: BarChart3,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
  },
  {
    step: '04',
    title: 'コピーを生成・ブラッシュアップ',
    desc: '5種類のAIコピーライターが20案以上を生成。気に入ったコピーは「もっとカジュアルに」などの指示でブラッシュアップできます。',
    icon: RefreshCw,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
  },
  {
    step: '05',
    title: 'エクスポート・活用',
    desc: 'Google広告・Yahoo!広告のインポート形式に準拠したCSVでエクスポート。そのまま広告管理ツールにインポートして使えます。',
    icon: Download,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
]

const WRITER_TYPES = [
  { name: 'ストレート型', desc: 'ベネフィットを直接・明確に伝える。「〜できる」「〜が手に入る」形式。', emoji: '🎯', examples: ['業務効率が3倍になるAIツール', '月10万円の副収入を実現する方法'] },
  { name: 'エモーショナル型', desc: 'ペインポイントや感情に訴求。「〜で悩んでいませんか？」などの共感型。', emoji: '❤️', examples: ['広告費が無駄になっていませんか？', 'もうコピーで悩まない'] },
  { name: 'ロジカル型', desc: '数字・実績・データで説得。「〇〇%改善」「累計〇万人」など。', emoji: '📊', examples: ['導入企業の89%がCVR改善', '3万人が選んだ広告制作ツール'] },
  { name: 'プロボカティブ型', desc: '常識を疑い、意外性で注目を集める。「〇〇はもう古い」など。', emoji: '⚡', examples: ['手書きのコピーはもう時代遅れ', 'なぜ同業他社はAIを使うのか'] },
  { name: 'ストーリー型', desc: 'ビフォーアフターや変化の物語で共感を呼ぶ。', emoji: '📖', examples: ['月50時間かかった作業が10分に', '3ヶ月で広告費を半分にした方法'] },
]

export default function CopyGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-600" />
            使い方ガイド
          </h1>
          <p className="text-gray-500 text-sm mt-1">ドヤコピーAIの使い方を5ステップで解説</p>
        </div>

        {/* ステップガイド */}
        <div className="space-y-4 mb-12">
          {STEPS.map((step, i) => (
            <div key={i} className="flex gap-4 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${step.bg} flex items-center justify-center`}>
                <step.icon className={`w-6 h-6 ${step.color}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black text-amber-500">STEP {step.step}</span>
                  <h3 className="font-bold text-gray-900">{step.title}</h3>
                </div>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ライタータイプ解説 */}
        <div className="mb-12">
          <h2 className="text-xl font-black text-gray-900 mb-6">5種類のAIコピーライター</h2>
          <div className="space-y-4">
            {WRITER_TYPES.map((writer, i) => (
              <div key={i} className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{writer.emoji}</span>
                  <h3 className="font-bold text-gray-900">{writer.name}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-3">{writer.desc}</p>
                <div className="space-y-1">
                  {writer.examples.map((ex, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span className="text-xs text-amber-700 font-mono">{ex}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-8 border-t border-gray-200">
          <p className="text-gray-500 mb-4">さっそく試してみましょう</p>
          <Link
            href="/copy/new"
            className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-white font-black rounded-2xl transition-colors text-lg"
          >
            <Sparkles className="w-5 h-5" />
            コピーを生成する
          </Link>
        </div>
      </div>
    </div>
  )
}
