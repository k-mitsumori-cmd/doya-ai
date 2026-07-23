'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  PenLine,
  BarChart3,
  ChevronRight,
  Plus,
  Clock,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getServiceById } from '@/lib/services'
import {
  LpShell, Hero, HowItWorks, Benefits, FeatureGrid, UseCases, FaqSection, CtaBand,
} from '@/components/lp'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'

const SVC = getServiceById('copy')!

interface CopyProject {
  id: string
  name: string
  status: string
  createdAt: string
  _count?: { copies: number }
}

export default function CopyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<CopyProject[]>([])
  const [loading, setLoading] = useState(false)

  const isSessionLoading = status === 'loading'
  const isLoggedIn = !!session?.user

  useEffect(() => {
    if (isLoggedIn) {
      fetchProjects()
    }
  }, [isLoggedIn])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/copy/projects?limit=5')
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
      }
    } catch {
      toast.error('プロジェクト一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // セッション読み込み中 → skeleton/pulse ローディング
  if (isSessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* ヘッダー skeleton */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="h-7 w-48 bg-gray-200 rounded-lg animate-pulse mb-2" />
              <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-10 w-36 bg-amber-200 rounded-xl animate-pulse" />
          </div>

          {/* クイックアクション skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 border border-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>

          {/* プロジェクト一覧 skeleton */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-40 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-white border border-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ログイン済み → ダッシュボード表示
  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                <PenLine className="w-6 h-6 text-amber-500" /> ドヤコピーAI
              </h1>
              <p className="text-gray-500 text-sm mt-1">広告コピーを、AIで量産する。</p>
            </div>
            <Link
              href="/copy/new"
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              新規コピー生成
            </Link>
          </div>

          {/* クイックアクション */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            <Link
              href="/copy/new"
              className="flex flex-col items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors text-center"
            >
              <PenLine className="w-6 h-6 text-amber-600" />
              <span className="text-sm font-bold text-gray-900">ディスプレイ広告</span>
              <span className="text-xs text-gray-500">20案以上生成</span>
            </Link>
            <Link
              href="/copy/new/search"
              className="flex flex-col items-center gap-2 p-4 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors text-center"
            >
              <BarChart3 className="w-6 h-6 text-orange-600" />
              <span className="text-sm font-bold text-gray-900">検索広告</span>
              <span className="text-xs text-gray-500">Google/Yahoo!</span>
            </Link>
            <Link
              href="/copy/new/sns"
              className="flex flex-col items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-xl hover:bg-yellow-100 transition-colors text-center"
            >
              <Sparkles className="w-6 h-6 text-yellow-600" />
              <span className="text-sm font-bold text-gray-900">SNS広告</span>
              <span className="text-xs text-gray-500">Meta/X/LINE</span>
            </Link>
          </div>

          {/* 最近のプロジェクト */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                最近のプロジェクト
              </h2>
              <Link href="/copy/history" className="text-sm text-amber-600 hover:text-amber-500 flex items-center gap-1">
                すべて見る <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">読み込み中...</div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 shadow-sm">
                <p className="text-gray-500 mb-4">まだプロジェクトがありません</p>
                <Link
                  href="/copy/new"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  最初のコピーを生成する
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/copy/${project.id}`}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <div>
                      <p className="font-bold text-gray-900">{project.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(project.createdAt).toLocaleDateString('ja-JP')} ·{' '}
                        {project._count?.copies ?? 0}件のコピー
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 未ログイン → 共通LPキットでランディング表示
  // CopyAppLayout（サイドバー付きシェル）の内側に描画されるため、
  // fixed オーバーレイでビューポート全体を覆い、LPを全幅で見せる。
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <LpShell serviceName="ドヤコピーAI" icon="edit_note" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
        <Hero
          eyebrow="広告コピー生成AI"
          title="広告コピーを、"
          highlight="AIで量産する。"
          subtitle="商材とペルソナを入力するだけ。5人のAIコピーライターが、異なる切り口で20案以上のコピーを瞬時に仕上げます。"
          note="無料プランで月10回までお試しいただけます"
          ctaHref={CTA}
          mood="working"
        />
        <HowItWorks
          title={<>入力するだけの<br className="md:hidden" />3ステップ</>}
          lead="アイデア出しから入稿データの書き出しまで、そのまま自動化します。"
          steps={STEPS}
        />
        <Benefits title="なぜ、コピー制作が変わるのか" items={BENEFITS} />
        <FeatureGrid lead="広告コピーづくりに必要な機能を、ひとつの画面に。" features={SVC.features} />
        {SVC.useCases && <UseCases items={SVC.useCases} />}
        <FaqSection items={FAQ} />
        <CtaBand
          title={<>次の広告、<br className="md:hidden" />コピーで差をつける。</>}
          subtitle="商材とペルソナを入れるだけ。今日からコピー制作が変わります。"
          ctaHref={CTA}
          ctaLabel="無料ではじめる"
          note="無料プランで月10回まで。クレジットカード登録は不要です"
          mood="jump"
        />
      </LpShell>
    </div>
  )
}
