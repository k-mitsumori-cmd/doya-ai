import { requirePromaneAuth, getWorkspaceBySlug } from '@/lib/promane/auth'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/promane/ui/button'
import { FeedbackButton } from '@/components/promane/feedback-button'

interface GuideSection {
  icon: string
  title: string
  description: string
  steps: string[]
  link?: { href: string; label: string }
}

const SECTIONS: GuideSection[] = [
  {
    icon: '/character/working.png',
    title: '1. プロジェクトを作成する',
    description: '案件・取引・サービスごとにプロジェクトを作って管理します。',
    steps: [
      '上部の「新規プロジェクト」ボタンをクリック',
      'プロジェクト名・顧客・契約金額を入力',
      '開始日・終了日を設定（ガントチャート用）',
      '保存すると、ダッシュボードに表示されます',
    ],
  },
  {
    icon: '/character/focus.png',
    title: '2. タスクをカンバンで管理',
    description: 'プロジェクト詳細ページで、タスクをドラッグ&ドロップで進捗管理。',
    steps: [
      'プロジェクト詳細ページで「カンバン」タブを開く',
      'タスクを追加（タイトル・担当者・期限・見積時間）',
      'やること→進行中→完了 にドラッグして進捗を更新',
      'ガントチャートで全体の進捗を一覧できます',
    ],
  },
  {
    icon: '/character/present.png',
    title: '3. 時間記録から人件費を自動計算',
    description: 'メンバーの作業時間を記録すると、時給×時間で人件費が自動計算されます。',
    steps: [
      'メンバー管理で各メンバーの時給を設定',
      '「タイムシート」ページで作業時間を記録',
      '人件費が自動でプロジェクト原価に反映',
      '「レポート」で売上−原価=利益を確認',
    ],
  },
  {
    icon: '/character/love.png',
    title: '4. メンバーを招待する',
    description: 'チームメンバーをワークスペースに招待して共同編集できます。',
    steps: [
      '「メンバー」ページで「招待」ボタンをクリック',
      '招待先のメールアドレスと役割を選択',
      '招待リンクが発行されるのでメールで送付',
      '招待先がGoogleログインすると参加完了',
    ],
  },
  {
    icon: '/character/success.png',
    title: '5. レポートで全体を把握',
    description: '売上・原価・利益のグラフで経営状況を可視化。',
    steps: [
      '「レポート」ページを開く',
      '月別・プロジェクト別の売上推移を確認',
      '利益率の高い案件・低い案件を特定',
      'クライアント別の貢献度も一覧表示',
    ],
  },
  {
    icon: '/character/jump.png',
    title: '6. 役割（権限）について',
    description: 'メンバーには4つの役割があります。',
    steps: [
      'オーナー: 全権限。ワークスペース削除可能',
      '管理者: メンバー招待・プロジェクト全管理',
      'メンバー: プロジェクト編集・タスク作業',
      'ゲスト: 閲覧のみ',
    ],
  },
]

export default async function HelpPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth()
  const { workspaceSlug } = await params
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!)
  if (!workspace) redirect('/promane')

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      <div className="flex items-center gap-5 mb-8 animate-slide-up">
        <Image src="/character/point.png" alt="" width={100} height={100} className="animate-bounce-in drop-shadow-xl" unoptimized />
        <div>
          <h1 className="text-[32px] font-black tracking-tight text-gray-900">使い方ガイド</h1>
          <p className="mt-0.5 text-[16px] text-gray-400 font-bold">ドヤプロマネの基本操作を解説するよ！</p>
        </div>
      </div>

      <div className="grid gap-5 mb-10">
        {SECTIONS.map((section, i) => (
          <div
            key={section.title}
            className={`rounded-[28px] bg-white ring-1 ring-gray-200 shadow-md p-7 animate-slide-up stagger-${Math.min(i + 1, 5)}`}
          >
            <div className="flex items-start gap-5">
              <Image src={section.icon} alt="" width={64} height={64} className="flex-shrink-0 animate-float drop-shadow-sm" unoptimized />
              <div className="flex-1 min-w-0">
                <h2 className="text-[22px] font-black text-gray-900">{section.title}</h2>
                <p className="mt-1.5 text-[15px] text-gray-500 font-bold leading-relaxed">{section.description}</p>
                <ol className="mt-4 space-y-2.5">
                  {section.steps.map((step, j) => (
                    <li key={j} className="flex items-start gap-3 text-[14px] text-gray-700 leading-relaxed">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center mt-0.5">
                        {j + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="rounded-[28px] bg-gradient-to-br from-blue-50 to-violet-50 ring-1 ring-blue-200 p-7 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <Image src="/character/thinking.png" alt="" width={48} height={48} unoptimized />
          <h2 className="text-[22px] font-black text-gray-900">よくある質問</h2>
        </div>
        <div className="space-y-4">
          <Faq q="他のドヤAIサービスとはどう違うの？" a="ドヤプロマネは案件管理・収支管理の専用ツールです。ドヤリスト（営業リスト）、ドヤSEO（記事生成）等のドヤAIサービスと並列で使えます。" />
          <Faq q="無料で使えますか？" a="無料プランで3プロジェクトまで使えます。それ以上はプロプラン（¥4,980/月）で無制限にご利用いただけます。" />
          <Faq q="データの削除・エクスポート" a="設定ページからCSVエクスポート可能。退会時は全データが削除されます。" />
        </div>
      </div>

      {/* Support */}
      <div className="rounded-[28px] bg-white ring-1 ring-gray-200 shadow-md p-7 text-center">
        <Image src="/character/love.png" alt="" width={80} height={80} className="mx-auto" unoptimized />
        <p className="mt-3 text-[17px] font-black text-gray-900">困ったら気軽に連絡してね！</p>
        <p className="mt-1 text-[12px] text-gray-500 font-bold">バグ報告・機能要望はワンクリックで Slack に届きます</p>
        <div className="mt-4 flex justify-center">
          <FeedbackButton variant="inline" className="rounded-full h-12 px-7 text-[14px] font-black bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white shadow-lg">
            🐛 不具合を報告 / 💡 要望を送る
          </FeedbackButton>
        </div>
        <p className="mt-3 text-[12px] text-gray-400">通常 1営業日以内に対応します</p>
      </div>
    </div>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 ring-1 ring-blue-100">
      <p className="text-[15px] font-black text-gray-800 mb-1.5">Q. {q}</p>
      <p className="text-[13px] text-gray-600 leading-relaxed">{a}</p>
    </div>
  )
}
