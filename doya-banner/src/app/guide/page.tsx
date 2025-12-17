'use client'

import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { 
  Sparkles, ArrowRight, ArrowLeft, Check, Play, 
  Image as ImageIcon, Layers, Target, Palette, 
  MousePointer, Download, HelpCircle, Lightbulb,
  ChevronRight, Zap, Clock, Shield, CheckCircle,
  Monitor, Smartphone, Square, RectangleHorizontal
} from 'lucide-react'

// 詳細ステップ
const DETAILED_STEPS = [
  {
    id: 1,
    title: 'カテゴリを選ぶ',
    description: '作りたいバナーの種類を選びます',
    details: [
      '通信向け（格安SIM・光回線など）、EC向け（セール・新商品など）から選択',
      'マーケティング（リード獲得・ウェビナー）、採用向け（求人・説明会）も対応',
      'カテゴリごとに最適化されたデザインが適用されます',
    ],
    tips: '迷ったら「通信向け」や「EC向け」から始めてみてください！',
    icon: Layers,
    color: 'bg-blue-500',
  },
  {
    id: 2,
    title: 'サイズを選ぶ',
    description: '広告プラットフォームに合わせたサイズを選択',
    details: [
      'Instagram/Facebook用（1080×1080）など人気サイズがワンタップ',
      'ストーリーズ用（1080×1920）にも対応',
      'ディスプレイ広告用の標準サイズも用意',
    ],
    tips: 'サイズに「人気」マークがついているものがおすすめです。',
    icon: Monitor,
    color: 'bg-green-500',
  },
  {
    id: 3,
    title: 'キーワードを入力',
    description: '訴求したい内容を短い言葉で入力',
    details: [
      '「月額990円〜」「今だけ50%OFF」など、伝えたいメッセージを入力',
      '短い言葉でOK！AIが最適なコピーに調整します',
      '「サジェスト」から人気キーワードも選べます',
    ],
    tips: '具体的な数字を入れると効果的です（例：「30%OFF」「3日間限定」）',
    icon: Target,
    color: 'bg-purple-500',
  },
  {
    id: 4,
    title: '生成ボタンを押す',
    description: 'ワンボタンでA/B/C 3案を自動生成',
    details: [
      '大きな「バナーを生成」ボタンを押すだけ',
      '約30秒でA案・B案・C案の3パターンが完成',
      'それぞれ異なる訴求軸（ベネフィット・緊急性・社会的証明）で生成',
    ],
    tips: '3案同時生成でABテストがすぐに始められます！',
    icon: Zap,
    color: 'bg-amber-500',
  },
  {
    id: 5,
    title: 'ダウンロードする',
    description: '気に入ったバナーをダウンロード',
    details: [
      '各バナーの「ダウンロード」ボタンで個別にダウンロード',
      '「まとめてダウンロード」で3案すべてをZIPで取得可能',
      '商用利用OK！広告・LP・SNSで自由に使えます',
    ],
    tips: '3案すべてダウンロードしてABテストするのがおすすめ！',
    icon: Download,
    color: 'bg-rose-500',
  },
]

// よくある質問
const FAQ = [
  {
    question: '本当に無料で使えますか？',
    answer: 'はい！無料プランでは1日1回（3案）まで生成できます。クレジットカードの登録も不要です。',
  },
  {
    question: '生成したバナーは広告に使えますか？',
    answer: 'はい、商用利用OKです。生成したバナーの著作権はお客様に帰属します。広告、LP、SNSなど自由にお使いいただけます。',
  },
  {
    question: 'デザインの知識がなくても使えますか？',
    answer: 'もちろんです！カテゴリを選んでキーワードを入れるだけで、デザイナー不要でプロ品質のバナーが作れます。',
  },
  {
    question: 'A/B/Cの3案はどう違うのですか？',
    answer: 'A案は「ベネフィット訴求」、B案は「緊急性・限定性」、C案は「社会的証明」という異なる心理的アプローチで生成されます。ABテストに最適です。',
  },
  {
    question: 'ブランドカラーは指定できますか？',
    answer: 'プロプランでは「ブランドキット」機能で、ロゴカラーやフォントの雰囲気を設定できます。ブランドガイドラインに沿った生成が可能です。',
  },
  {
    question: '気に入らなかったら再生成できますか？',
    answer: 'はい、何度でも再生成できます（1日の回数制限あり）。結果に満足いただけるまでお試しください。',
  },
]

// サイズプリセット
const SIZE_EXAMPLES = [
  { icon: Square, name: '1080×1080', platform: 'Instagram / Facebook', popular: true },
  { icon: RectangleHorizontal, name: '1200×628', platform: 'Facebook広告', popular: true },
  { icon: Smartphone, name: '1080×1920', platform: 'ストーリーズ', popular: false },
  { icon: Monitor, name: '300×250', platform: 'ディスプレイ広告', popular: false },
]

// カテゴリ例
const CATEGORY_EXAMPLES = [
  { icon: '📱', name: '通信向け', examples: ['格安SIM', '光回線', '乗り換え'] },
  { icon: '🛒', name: 'EC向け', examples: ['セール', '新商品', 'キャンペーン'] },
  { icon: '📊', name: 'マーケティング', examples: ['リード獲得', 'ウェビナー', '資料DL'] },
  { icon: '👥', name: '採用向け', examples: ['求人', '説明会', 'インターン'] },
]

export default function GuidePage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">ドヤバナー</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            トップに戻る
          </Link>
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
            ドヤバナー の使い方
          </h1>
          <p className="text-xl text-gray-600">
            デザイナー不要！<br />
            誰でもプロ品質のバナーを作れます
          </p>
        </div>

        {/* 概要 */}
        <section className="mb-16">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 border border-blue-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-amber-500" />
              ドヤバナーとは？
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              ドヤバナーは、<strong>AIがバナー広告を自動で作ってくれるサービス</strong>です。<br />
              カテゴリを選んでキーワードを入れるだけで、<strong>A/B/Cの3パターン</strong>を同時に生成。<br />
              デザインの知識がなくても、プロ品質のバナーが作れます。
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Clock, text: '30秒で完成', color: 'text-blue-600' },
                { icon: Layers, text: '3案同時生成', color: 'text-purple-600' },
                { icon: Shield, text: '商用利用OK', color: 'text-green-600' },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm">
                  <item.icon className={`w-6 h-6 ${item.color}`} />
                  <span className="font-medium text-gray-900">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 生成されるバナーのイメージ */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            こんなバナーが作れます
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'A', type: 'ベネフィット訴求', color: 'from-blue-500 to-indigo-600', desc: '得られるメリットを訴求' },
              { label: 'B', type: '緊急性・限定性', color: 'from-amber-500 to-orange-500', desc: '今すぐ行動を促す' },
              { label: 'C', type: '社会的証明', color: 'from-emerald-500 to-green-500', desc: '実績・信頼性を訴求' },
            ].map((banner, index) => (
              <div key={index} className="text-center">
                <div className={`aspect-square rounded-2xl bg-gradient-to-br ${banner.color} flex flex-col items-center justify-center text-white p-4 shadow-lg`}>
                  <span className="text-4xl font-bold mb-2">{banner.label}</span>
                  <span className="text-sm font-medium">{banner.type}</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">{banner.desc}</p>
              </div>
            ))}
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

        {/* カテゴリ紹介 */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            対応カテゴリ
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {CATEGORY_EXAMPLES.map((category, index) => (
              <div 
                key={index}
                className="bg-gray-50 rounded-xl p-5 hover:bg-blue-50 border-2 border-transparent hover:border-blue-200 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{category.icon}</span>
                  <h3 className="font-bold text-gray-900 text-lg">{category.name}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {category.examples.map((example, i) => (
                    <span key={i} className="px-3 py-1 bg-white text-gray-600 rounded-full text-sm border border-gray-200">
                      {example}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* サイズ紹介 */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            対応サイズ
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SIZE_EXAMPLES.map((size, index) => (
              <div 
                key={index}
                className="bg-white rounded-xl p-5 border-2 border-gray-100 text-center relative"
              >
                {size.popular && (
                  <span className="absolute -top-2 -right-2 px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">
                    人気
                  </span>
                )}
                <size.icon className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="font-bold text-gray-900">{size.name}</p>
                <p className="text-sm text-gray-500">{size.platform}</p>
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
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-10 text-white">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              さあ、ドヤれるバナーを作ろう！
            </h2>
            <p className="text-lg text-blue-100 mb-8">
              無料で登録して、今すぐバナーを作ってみましょう
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => signIn()}
                className="inline-flex items-center justify-center gap-3 bg-white text-blue-600 font-bold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors shadow-lg text-lg"
              >
                <Sparkles className="w-6 h-6" />
                無料で始める
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
            <p className="mt-5 text-blue-200">
              ✓ クレジットカード不要　✓ 1日1枚無料　✓ 30秒で登録完了
            </p>
          </div>
        </section>
      </main>

      {/* フッター */}
      <footer className="bg-gray-100 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">ドヤバナー</span>
          </div>
          <p className="text-base text-gray-600">© 2024 ドヤバナー</p>
        </div>
      </footer>
    </div>
  )
}

