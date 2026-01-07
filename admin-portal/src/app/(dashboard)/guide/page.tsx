'use client'

import { useState } from 'react'
import { 
  HelpCircle, ChevronRight, Check, Lightbulb,
  LayoutDashboard, Users, TrendingUp, Settings, 
  Sparkles, Palette, Shield, Key
} from 'lucide-react'
import { SERVICES } from '@/lib/services'
import { cn } from '@/lib/utils'

// 管理ポータルの使い方
const GUIDE_SECTIONS = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: '統合ダッシュボード',
    description: '全サービスの状況を一覧で把握',
    steps: [
      '「統合ダッシュボード」をクリックして開きます',
      '上部のサマリーカードで全体の統計を確認',
      'サービス別のカードで各サービスの状況を確認',
      '最新アクティビティで直近の動きをチェック',
    ],
    tips: 'ダッシュボードは自動更新されませんので、「更新」ボタンで最新情報を取得してください。',
  },
  {
    id: 'services',
    icon: Sparkles,
    title: 'サービス詳細',
    description: '各サービスの詳細統計を確認',
    steps: [
      'サイドバーから確認したいサービスを選択',
      '統計カードでユーザー数・生成数・収益を確認',
      '最近のアクティビティで詳細な動きを把握',
      '「サービスを開く」で実際のサービスにアクセス',
    ],
    tips: '各サービスの管理画面にも直接アクセスできます。',
  },
  {
    id: 'users',
    icon: Users,
    title: 'ユーザー管理',
    description: '全サービスのユーザーを統合管理',
    steps: [
      'サイドバーから「ユーザー管理」を選択',
      '検索ボックスで名前やメールでユーザーを検索',
      'サービス別・プラン別でフィルタリング',
      'テーブルで各ユーザーの詳細を確認',
    ],
    tips: 'フィルターを組み合わせることで、特定の条件のユーザーを素早く見つけられます。',
  },
  {
    id: 'revenue',
    icon: TrendingUp,
    title: '収益レポート',
    description: 'サービス別の収益状況を分析',
    steps: [
      'サイドバーから「収益レポート」を選択',
      '期間（月次/四半期/年次）を切り替えて分析',
      'サービス別収益の比較を確認',
      '月次推移で成長トレンドを把握',
    ],
    tips: 'ARPUや成長率を見ることで、サービスの健全性を評価できます。',
  },
  {
    id: 'settings',
    icon: Settings,
    title: '設定',
    description: 'ポータルの各種設定を管理',
    steps: [
      'サイドバーから「設定」を選択',
      'サービス接続状況を確認',
      '通知設定で必要な通知を選択',
      'セキュリティ設定でパスワード等を管理',
    ],
    tips: '本番環境では必ず管理者パスワードを変更してください。',
  },
]

// よくある質問
const FAQ = [
  {
    question: '複数人で管理画面を使えますか？',
    answer: '現在は1つの管理者パスワードで共有する形です。将来的にはマルチユーザー対応を予定しています。',
  },
  {
    question: 'データはリアルタイムで更新されますか？',
    answer: 'いいえ、手動で「更新」ボタンを押すことで最新データを取得します。',
  },
  {
    question: 'サービスの統計が表示されない場合は？',
    answer: '各サービスのAPIが正常に動作しているか確認してください。設定画面でサービス接続状況を確認できます。',
  },
  {
    question: 'ログイン情報を忘れた場合は？',
    answer: '環境変数 ADMIN_PASSWORD を確認・変更してください。デフォルトは「doya-admin-2024」です。',
  },
]

export default function GuidePage() {
  const [openSectionId, setOpenSectionId] = useState<string | null>('dashboard')
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* ヘッダー */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mb-4">
          <HelpCircle className="w-4 h-4" />
          ヘルプ
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          統合管理ポータルの使い方
        </h1>
        <p className="text-gray-600">
          ドヤシリーズの管理ポータルの操作方法を説明します
        </p>
      </div>

      {/* 管理対象サービス */}
      <section className="mb-12">
        <h2 className="text-lg font-bold text-gray-900 mb-4">管理対象サービス</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {SERVICES.map((service) => (
            <div 
              key={service.id}
              className={cn("card flex items-center gap-4 border-2", service.borderColor)}
            >
              <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center text-2xl", service.bgColor)}>
                {service.icon}
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{service.name}</h3>
                <p className="text-sm text-gray-500">{service.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 機能ガイド */}
      <section className="mb-12">
        <h2 className="text-lg font-bold text-gray-900 mb-4">機能ガイド</h2>
        <div className="space-y-3">
          {GUIDE_SECTIONS.map((section) => (
            <div 
              key={section.id}
              className="bg-white rounded-xl border-2 border-gray-100 overflow-hidden"
            >
              <button
                onClick={() => setOpenSectionId(openSectionId === section.id ? null : section.id)}
                className="w-full text-left p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <section.icon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{section.title}</h3>
                  <p className="text-sm text-gray-500">{section.description}</p>
                </div>
                <ChevronRight 
                  className={cn(
                    "w-6 h-6 text-gray-400 transition-transform flex-shrink-0",
                    openSectionId === section.id && "rotate-90"
                  )}
                />
              </button>

              {openSectionId === section.id && (
                <div className="px-5 pb-5">
                  <div className="bg-gray-50 rounded-xl p-5">
                    <h4 className="font-bold text-gray-900 mb-3">操作手順</h4>
                    <ol className="space-y-2 mb-4">
                      {section.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-gray-700">{step}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <p className="text-amber-800 text-sm flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span><strong>ヒント：</strong>{section.tips}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* よくある質問 */}
      <section className="mb-12">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600" />
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
                <span className="font-bold text-gray-900 pr-4">{faq.question}</span>
                <ChevronRight 
                  className={cn(
                    "w-6 h-6 text-gray-400 transition-transform flex-shrink-0",
                    openFaqIndex === index && "rotate-90"
                  )}
                />
              </button>
              {openFaqIndex === index && (
                <div className="px-5 pb-5">
                  <p className="text-gray-700 bg-gray-50 rounded-xl p-4">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 初期設定 */}
      <section className="mb-12">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-gray-400" />
          初期設定
        </h2>
        <div className="card bg-gradient-to-br from-slate-50 to-gray-50 border-2 border-slate-200">
          <h3 className="font-bold text-gray-900 mb-4">環境変数の設定</h3>
          <div className="space-y-3 font-mono text-sm">
            <div className="bg-gray-900 rounded-lg p-4 text-gray-100 overflow-x-auto">
              <p className="text-gray-400"># 管理者認証</p>
              <p>ADMIN_PASSWORD=your-secure-password</p>
              <p>ADMIN_JWT_SECRET=your-jwt-secret-key</p>
              <p className="text-gray-400 mt-2"># サービスAPI URL</p>
              <p>KANTAN_DOYA_API_URL=https://kantan-doya-ai.vercel.app</p>
              <p>DOYA_BANNER_API_URL=https://doya-banner.vercel.app</p>
            </div>
          </div>
          <div className="mt-4 bg-red-50 rounded-lg p-4 border border-red-200">
            <p className="text-red-800 text-sm flex items-start gap-2">
              <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span><strong>重要：</strong>本番環境では必ずADMIN_PASSWORDとADMIN_JWT_SECRETを変更してください。</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

