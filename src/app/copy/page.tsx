'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  PenLine,
  Zap,
  BarChart3,
  Download,
  RefreshCw,
  Shield,
  ChevronRight,
  Plus,
  Clock,
  Sparkles,
} from 'lucide-react'
import { motion } from 'framer-motion'

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
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const FEATURES = [
    {
      icon: PenLine,
      title: '20案以上を一括生成',
      desc: '1回の生成でディスプレイ広告コピーを20案以上出力。A/Bテスト用の大量バリエーションを瞬時に作成。',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      icon: Sparkles,
      title: '5種類のAIコピーライター',
      desc: 'ストレート・エモーショナル・ロジカル・プロボカティブ・ストーリーの5タイプが異なる切り口で提案。',
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      icon: BarChart3,
      title: '検索広告RSA対応',
      desc: 'Google/Yahoo!広告の文字数制限を自動遵守。レスポンシブ検索広告のアセットをまとめて生成。',
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      icon: RefreshCw,
      title: 'チャット形式ブラッシュアップ',
      desc: '「もっとカジュアルに」「数字を入れて」など自然な指示で修正。リビジョン履歴も自動保存。',
      color: 'text-amber-600',
      bg: 'bg-amber-600/10',
    },
    {
      icon: Shield,
      title: 'レギュレーション設定',
      desc: 'NG表現・必須キーワード・文字数制限をプロジェクトごとに設定。薬機法・景品表示法に対応。',
      color: 'text-orange-600',
      bg: 'bg-orange-600/10',
    },
    {
      icon: Download,
      title: 'CSV/Excelエクスポート',
      desc: 'Google広告・Yahoo!広告のインポート形式に準拠したCSVで一括エクスポート。',
      color: 'text-yellow-600',
      bg: 'bg-yellow-600/10',
    },
  ]

  const WRITER_TYPES = [
    { name: 'ストレート', desc: 'ベネフィット直訴型', emoji: '🎯' },
    { name: 'エモーショナル', desc: 'ペインポイント訴求型', emoji: '❤️' },
    { name: 'ロジカル', desc: 'データ・実績訴求型', emoji: '📊' },
    { name: 'プロボカティブ', desc: '常識を覆す切り口', emoji: '⚡' },
    { name: 'ストーリー', desc: 'ビフォーアフター型', emoji: '📖' },
  ]

  // セッション読み込み中 → ローディング画面
  if (isSessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <PenLine className="w-7 h-7 text-white animate-pulse" />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-2">ドヤコピーAI</h2>
          <p className="text-sm text-gray-500 mb-4">読み込み中です。少々お待ちください...</p>
          <div className="flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-amber-500"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
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
                <span>✍️</span> ドヤコピーAI
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
              href="/copy/new?type=search"
              className="flex flex-col items-center gap-2 p-4 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors text-center"
            >
              <BarChart3 className="w-6 h-6 text-orange-600" />
              <span className="text-sm font-bold text-gray-900">検索広告</span>
              <span className="text-xs text-gray-500">Google/Yahoo!</span>
            </Link>
            <Link
              href="/copy/new?type=sns"
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

  // 未ログイン → LP表示
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-orange-50" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-100 border border-amber-300 rounded-full text-amber-700 text-sm font-bold mb-6">
              <Zap className="w-4 h-4" />
              NEW — ドヤコピーAI
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4 leading-tight">
              広告コピーを、<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">
                AIで量産する。
              </span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              商品URLとペルソナを入力するだけで、5種類のAIコピーライターが
              20案以上の広告コピーを瞬時に生成。ブラッシュアップ機能で実用品質まで磨き上げる。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/api/auth/signin?callbackUrl=/copy/new"
                className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-white font-black rounded-2xl transition-colors text-lg shadow-lg shadow-amber-500/20"
              >
                <Sparkles className="w-5 h-5" />
                無料で試す（月10回）
              </Link>
              <Link
                href="/copy/guide"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors text-lg border border-gray-300"
              >
                使い方を見る
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* AIコピーライタータイプ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-2xl font-black text-gray-900 text-center mb-8">
          5種類のAIコピーライターが<br className="sm:hidden" />異なる切り口で提案
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {WRITER_TYPES.map((writer) => (
            <div
              key={writer.name}
              className="p-4 bg-white border border-gray-200 rounded-xl text-center shadow-sm"
            >
              <div className="text-2xl mb-2">{writer.emoji}</div>
              <p className="text-sm font-bold text-gray-900">{writer.name}</p>
              <p className="text-xs text-gray-500 mt-1">{writer.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 機能一覧 */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-2xl font-black text-gray-900 text-center mb-8">すべての機能</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className={`inline-flex p-2 rounded-lg ${f.bg} mb-3`}>
                <f.icon className={`w-5 h-5 ${f.color}`} />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-2xl font-black text-gray-900 mb-4">今すぐ試してみる</h2>
        <p className="text-gray-500 mb-6">無料プランで月10回まで生成可能。クレジットカード不要。</p>
        <Link
          href="/api/auth/signin?callbackUrl=/copy/new"
          className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-white font-black rounded-2xl transition-colors text-lg shadow-lg shadow-amber-500/20"
        >
          <Sparkles className="w-5 h-5" />
          無料で始める
        </Link>
        <p className="text-gray-400 text-sm mt-4">
          <Link href="/copy/pricing" className="text-amber-600 hover:underline">
            料金プランを見る
          </Link>
        </p>
      </section>
    </div>
  )
}
