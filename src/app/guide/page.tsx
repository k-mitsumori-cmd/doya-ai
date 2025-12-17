'use client'

import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { 
  Sparkles, ArrowRight, ArrowLeft, Check, Play, 
  MessageSquare, FileText, Mail, Lightbulb, 
  MousePointer, Copy, Download, Star, HelpCircle,
  ChevronRight, Zap, Clock, Shield, CheckCircle
} from 'lucide-react'
import { useState } from 'react'

// 使い方の詳細ステップ
const DETAILED_STEPS = [
  {
    id: 1,
    title: 'テンプレートを選ぶ',
    description: 'まず、作りたい文章の種類を選びます',
    details: [
      '「ビジネスメール」「お知らせ文」「SNS投稿」など、目的に合ったテンプレートを選択',
      '全68種類のテンプレートから選べます',
      '人気順・カテゴリ別で探しやすい',
    ],
    tips: 'どれを選べばいいか迷ったら、「ビジネスメール」から始めるのがおすすめです！',
    icon: FileText,
    color: 'bg-blue-500',
  },
  {
    id: 2,
    title: '情報を入力する',
    description: '文章に必要な情報を入力します',
    details: [
      '「件名」「相手の名前」「要件」など、簡単な項目に入力するだけ',
      '難しい文章を考える必要はありません',
      '入力欄には例文が表示されるので、参考にできます',
    ],
    tips: '短い言葉でOK！AIが自然な文章に仕上げます。',
    icon: MessageSquare,
    color: 'bg-green-500',
  },
  {
    id: 3,
    title: '「生成」ボタンを押す',
    description: 'ボタンを押すと、AIが文章を作ります',
    details: [
      '大きな「生成」ボタンを押すだけ',
      '10〜20秒ほどで文章が完成します',
      '待っている間、進行状況が表示されます',
    ],
    tips: '生成中は画面を閉じないでください。',
    icon: Zap,
    color: 'bg-purple-500',
  },
  {
    id: 4,
    title: '文章をコピーする',
    description: '完成した文章をコピーして使います',
    details: [
      '「コピー」ボタンを押すと、文章がコピーされます',
      'メールやチャットに貼り付けて使えます',
      '気に入らなければ「もう一度生成」できます',
    ],
    tips: '何度でも無料で再生成できます（1日の回数制限あり）',
    icon: Copy,
    color: 'bg-orange-500',
  },
]

// よくある質問
const FAQ = [
  {
    question: '本当に無料で使えますか？',
    answer: 'はい！無料プランでは1日10回まで文章を生成できます。クレジットカードの登録も不要です。',
  },
  {
    question: '生成された文章はそのまま使っていいですか？',
    answer: 'はい、そのまま使えます。ただし、内容を確認してから送ることをおすすめします。必要に応じて修正してください。',
  },
  {
    question: '難しい操作は必要ですか？',
    answer: 'いいえ！選ぶ→入力する→ボタンを押す、の3ステップだけです。パソコンが苦手な方でも安心して使えます。',
  },
  {
    question: '履歴は残りますか？',
    answer: 'はい、過去に生成した文章は履歴として保存されます。後から確認したり、再利用することができます。',
  },
  {
    question: 'スマートフォンでも使えますか？',
    answer: 'はい！スマートフォン、タブレット、パソコン、どの端末からでも使えます。',
  },
  {
    question: '途中で止めても大丈夫ですか？',
    answer: 'はい、いつでも中断できます。入力した内容は次回まで保存されませんが、やり直しは簡単です。',
  },
]

// テンプレート例
const TEMPLATE_EXAMPLES = [
  { icon: '📧', name: 'ビジネスメール', desc: 'お礼・お詫び・依頼など' },
  { icon: '📝', name: 'お知らせ文', desc: '社内連絡・告知など' },
  { icon: '📱', name: 'SNS投稿', desc: 'Twitter・Instagram・Facebookなど' },
  { icon: '✨', name: 'キャッチコピー', desc: '商品・サービスの宣伝文' },
  { icon: '📋', name: '提案書', desc: '企画・プレゼン資料' },
  { icon: '📄', name: 'ブログ記事', desc: '見出し・本文の構成' },
]

export default function GuidePage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="bg-white border-b-2 border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">カンタンドヤAI</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              トップに戻る
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* ページタイトル */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mb-4">
            <HelpCircle className="w-4 h-4" />
            はじめての方へ
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            カンタンドヤAI の使い方
          </h1>
          <p className="text-xl text-gray-600">
            初めての方でも安心！<br />
            わかりやすく説明します
          </p>
        </div>

        {/* 概要 */}
        <section className="mb-16">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 border border-blue-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-amber-500" />
              カンタンドヤAIとは？
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              カンタンドヤAIは、<strong>AIが文章を自動で作ってくれるサービス</strong>です。<br />
              ビジネスメール、お知らせ文、SNS投稿など、様々な文章を簡単に作成できます。
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Clock, text: '1分で文章完成', color: 'text-blue-600' },
                { icon: Shield, text: '登録無料', color: 'text-green-600' },
                { icon: CheckCircle, text: '難しい操作なし', color: 'text-purple-600' },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm">
                  <item.icon className={`w-6 h-6 ${item.color}`} />
                  <span className="font-medium text-gray-900">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 詳細ステップ */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            使い方 ステップバイステップ
          </h2>

          <div className="space-y-8">
            {DETAILED_STEPS.map((step, index) => (
              <div key={step.id} className="relative">
                {/* コネクター */}
                {index < DETAILED_STEPS.length - 1 && (
                  <div className="absolute left-7 top-20 bottom-0 w-0.5 bg-gray-200 -mb-8" />
                )}

                <div className="bg-white rounded-2xl border-2 border-gray-100 p-6 sm:p-8 hover:border-blue-200 hover:shadow-lg transition-all">
                  <div className="flex items-start gap-5">
                    {/* ステップ番号 */}
                    <div className={`w-14 h-14 ${step.color} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                      <span className="text-2xl font-bold text-white">{step.id}</span>
                    </div>

                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                      <p className="text-lg text-gray-600 mb-4">{step.description}</p>

                      {/* 詳細リスト */}
                      <ul className="space-y-2 mb-4">
                        {step.details.map((detail, i) => (
                          <li key={i} className="flex items-start gap-3 text-gray-700">
                            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>

                      {/* ヒント */}
                      <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                        <p className="text-amber-800 text-sm flex items-start gap-2">
                          <Lightbulb className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <span><strong>ヒント：</strong>{step.tips}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* テンプレート紹介 */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            こんな文章が作れます
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATE_EXAMPLES.map((template, index) => (
              <div 
                key={index}
                className="bg-gray-50 rounded-xl p-5 hover:bg-blue-50 hover:border-blue-200 border-2 border-transparent transition-all"
              >
                <span className="text-4xl block mb-3">{template.icon}</span>
                <h3 className="font-bold text-gray-900 mb-1">{template.name}</h3>
                <p className="text-sm text-gray-600">{template.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* よくある質問 */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center flex items-center justify-center gap-2">
            <HelpCircle className="w-6 h-6 text-blue-600" />
            よくある質問
          </h2>

          <div className="space-y-3">
            {FAQ.map((faq, index) => (
              <div 
                key={index}
                className="bg-white rounded-xl border-2 border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  className="w-full text-left p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-bold text-gray-900 text-lg pr-4">{faq.question}</span>
                  <ChevronRight 
                    className={`w-6 h-6 text-gray-400 transition-transform flex-shrink-0 ${
                      openFaqIndex === index ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                {openFaqIndex === index && (
                  <div className="px-5 pb-5 pt-0">
                    <p className="text-gray-700 text-lg leading-relaxed bg-gray-50 rounded-xl p-4">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-10 text-white">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              さあ、始めましょう！
            </h2>
            <p className="text-lg text-blue-100 mb-8">
              無料で登録して、今すぐ文章を作ってみましょう
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => signIn()}
                className="inline-flex items-center justify-center gap-3 bg-white text-blue-600 font-bold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors shadow-lg text-lg min-h-[56px]"
              >
                <Sparkles className="w-6 h-6" />
                無料で始める
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
            <p className="mt-5 text-blue-200">
              ✓ クレジットカード不要　✓ 30秒で登録完了
            </p>
          </div>
        </section>
      </main>

      {/* フッター */}
      <footer className="bg-gray-100 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">カンタンドヤAI</span>
          </div>
          <p className="text-base text-gray-600">© 2024 カンタンドヤAI</p>
        </div>
      </footer>
    </div>
  )
}

