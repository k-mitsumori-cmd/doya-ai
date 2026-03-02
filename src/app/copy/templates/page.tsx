'use client'

import Link from 'next/link'
import { BookOpen, Sparkles } from 'lucide-react'

const WRITER_TEMPLATES = [
  {
    id: 'straight',
    name: 'ストレート型',
    emoji: '🎯',
    tagline: 'ベネフィット直訴型',
    desc: 'ベネフィットを直接・明確に伝える。事実とメリットで勝負するシンプルなスタイル。',
    examples: [
      '30秒で請求書を作成できるクラウド会計',
      '月1万円から始める不動産投資',
      '1日10分で英語が話せるようになるアプリ',
    ],
    bestFor: '比較検討している顧客、機能重視のB2B商材',
    color: 'from-amber-50 to-amber-100',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-600',
  },
  {
    id: 'emotional',
    name: 'エモーショナル型',
    emoji: '❤️',
    tagline: 'ペインポイント訴求型',
    desc: '悩みや感情に寄り添い、共感から解放へ導く。問題意識が高い顧客に効果的。',
    examples: [
      '毎月の経費管理、もう嫌になっていませんか？',
      '老後の資金が不安なあなたへ',
      '英語で話しかけられるたびに焦っていませんか？',
    ],
    bestFor: '悩みが明確な消費者、感情訴求が効くB2C商材',
    color: 'from-orange-50 to-orange-100',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-600',
  },
  {
    id: 'logical',
    name: 'ロジカル型',
    emoji: '📊',
    tagline: 'データ・実績訴求型',
    desc: '数字・実績・データで客観的に説得する。信頼性と根拠を重視する顧客に響く。',
    examples: [
      '導入企業の92%が作業時間を50%削減',
      '累計3万社が選ぶ会計ソフト',
      '独自メソッドでTOEIC平均215点アップ',
    ],
    bestFor: '判断基準が明確なB2B、高額商材の購買決裁者',
    color: 'from-yellow-50 to-yellow-100',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-600',
  },
  {
    id: 'provocative',
    name: 'プロボカティブ型',
    emoji: '⚡',
    tagline: '常識を覆す切り口',
    desc: '意外性・挑発・逆張りで注目を集める。飽和した広告市場でスクロールを止める。',
    examples: [
      'なぜあなたの広告費は無駄になっているのか',
      '税理士を雇う必要はない時代になった',
      '英会話スクールに通っても話せないのはなぜか',
    ],
    bestFor: '競合が多い市場、認知拡大フェーズ',
    color: 'from-red-50 to-red-100',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-600',
  },
  {
    id: 'story',
    name: 'ストーリー型',
    emoji: '📖',
    tagline: 'ビフォーアフター型',
    desc: '変化の物語・ビフォーアフターで共感を呼ぶ。感情移入させ、自分事として捉えさせる。',
    examples: [
      '月80時間の残業が、AIで10時間になった話',
      '貯金ゼロから3年で資産1,000万円を達成した方法',
      '英語コンプレックスだった私が、外資系に転職できた理由',
    ],
    bestFor: 'SNS広告、LP冒頭、感情的な購買決定を促す場面',
    color: 'from-purple-50 to-purple-100',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-600',
  },
]

export default function CopyTemplatesPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-600" />
            ライタープリセット
          </h1>
          <p className="text-gray-500 text-sm mt-1">5種類のAIコピーライタースタイルの詳細と活用事例</p>
        </div>

        <div className="space-y-6">
          {WRITER_TEMPLATES.map((wt) => (
            <div
              key={wt.id}
              className={`p-6 bg-gradient-to-br ${wt.color} border ${wt.border} rounded-2xl`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{wt.emoji}</span>
                  <div>
                    <h3 className="text-lg font-black text-gray-900">{wt.name}</h3>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${wt.badge}`}>
                      {wt.tagline}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-4">{wt.desc}</p>

              <div className="mb-4">
                <p className="text-xs font-bold text-gray-500 mb-2">コピー例</p>
                <div className="space-y-1">
                  {wt.examples.map((ex, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-amber-500 text-xs">▸</span>
                      <span className="text-sm text-gray-800 font-mono">{ex}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500">おすすめ活用場面:</span>
                <span className="text-xs text-gray-600">{wt.bestFor}</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
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
