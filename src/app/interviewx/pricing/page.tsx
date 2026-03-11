'use client'

import { Check, X } from 'lucide-react'

const PLANS = [
  {
    id: 'interviewx-free',
    name: '無料',
    price: 0,
    priceLabel: '¥0',
    period: '',
    description: 'まずはヒヤリングAIを体験',
    features: [
      { text: '月3プロジェクトまで', included: true },
      { text: 'AI質問生成', included: true },
      { text: 'AIチャットヒヤリング', included: true },
      { text: 'AI要約生成', included: true },
      { text: 'Markdownエクスポート', included: true },
      { text: 'メール通知', included: false },
      { text: 'ブランドカスタマイズ', included: false },
      { text: 'URL事前調査', included: false },
    ],
    cta: '無料で試す',
  },
  {
    id: 'interviewx-light',
    name: 'ライト',
    price: 2980,
    priceLabel: '¥2,980',
    period: '/月（税込）',
    description: '個人・小規模チーム向け',
    color: 'blue',
    features: [
      { text: '月10プロジェクトまで', included: true },
      { text: 'AI質問生成', included: true },
      { text: 'AIチャットヒヤリング', included: true },
      { text: 'AI要約生成', included: true },
      { text: 'HTML/Markdownエクスポート', included: true },
      { text: 'メール通知', included: true },
      { text: 'URL事前調査', included: true },
      { text: 'ブランドカスタマイズ', included: false },
    ],
    cta: 'ライトプランを始める',
  },
  {
    id: 'interviewx-pro',
    name: 'プロ',
    price: 9980,
    priceLabel: '¥9,980',
    period: '/月（税込）',
    description: '本格的なヒヤリング運用に',
    popular: true,
    color: 'indigo',
    features: [
      { text: '月50プロジェクトまで', included: true },
      { text: 'AI質問生成', included: true },
      { text: 'AIチャットヒヤリング', included: true },
      { text: 'AI要約生成', included: true },
      { text: 'HTML/Markdownエクスポート', included: true },
      { text: 'メール通知', included: true },
      { text: 'URL事前調査', included: true },
      { text: 'ブランドカスタマイズ', included: true },
    ],
    cta: 'プロプランを始める',
  },
  {
    id: 'interviewx-enterprise',
    name: 'エンタープライズ',
    price: 49800,
    priceLabel: '¥49,800',
    period: '/月（税込）',
    description: '大規模チーム・法人向け',
    color: 'slate',
    features: [
      { text: '無制限プロジェクト', included: true },
      { text: 'AI質問生成', included: true },
      { text: 'AIチャットヒヤリング', included: true },
      { text: 'AI要約生成', included: true },
      { text: 'HTML/Markdownエクスポート', included: true },
      { text: 'メール通知', included: true },
      { text: 'URL事前調査', included: true },
      { text: 'ブランドカスタマイズ・専任サポート', included: true },
    ],
    cta: 'お問い合わせ',
  },
]

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-black mb-3">
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            料金プラン
          </span>
        </h1>
        <p className="text-slate-500">AIチャットで自動ヒヤリング＆要約生成</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(plan => (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl border-2 p-6 ${
              plan.popular ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-slate-200'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold">
                人気
              </div>
            )}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h3>
              <p className="text-xs text-slate-500 mb-4">{plan.description}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-slate-900">{plan.priceLabel}</span>
                {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
              </div>
            </div>

            <ul className="space-y-2.5 mb-6">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {f.included ? (
                    <Check className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <X className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                  )}
                  <span className={f.included ? 'text-slate-700' : 'text-slate-400'}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>

            <button
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                plan.popular
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-600 hover:to-violet-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="mt-16">
        <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">よくある質問</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {[
            {
              q: 'プロジェクト数の制限とは？',
              a: '月間で新規作成できるヒヤリングプロジェクト数の上限です。既存プロジェクトの閲覧・編集は制限に含まれません。',
            },
            {
              q: '回答者にコストはかかりますか？',
              a: 'いいえ。回答者はログイン不要で、共有URLから無料でヒヤリングに回答できます。',
            },
            {
              q: 'ブランドカスタマイズとは？',
              a: '公開ヒヤリングページに企業ロゴやブランドカラーを反映できる機能です。',
            },
            {
              q: 'プランの変更はできますか？',
              a: 'はい。いつでもアップグレード・ダウングレードが可能です。',
            },
          ].map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="font-bold text-slate-900 text-sm mb-2">{faq.q}</p>
              <p className="text-sm text-slate-500">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
