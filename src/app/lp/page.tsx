'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { PlusCircle, FileText, Clock, ArrowRight, Link2, Layout, PenLine, Palette, Trash2, Loader2, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'

interface LpProject {
  id: string
  name: string
  status: string
  themeId: string
  createdAt: string
  sections: { name: string }[]
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '下書き', color: 'text-slate-400 bg-slate-800' },
  generating: { label: '生成中', color: 'text-amber-400 bg-amber-500/10' },
  editing: { label: '編集中', color: 'text-blue-400 bg-blue-500/10' },
  completed: { label: '完成', color: 'text-cyan-400 bg-cyan-500/10' },
  published: { label: '公開中', color: 'text-green-400 bg-green-500/10' },
}

const FEATURES = [
  {
    icon: Link2,
    title: 'URL/手動入力で情報取得',
    desc: 'LPのURLを入れるだけで商品情報を自動抽出。手動入力にも対応。',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: Layout,
    title: '3パターンの構成案',
    desc: 'AIがLP目的に合わせた最適な構成を3パターン提案。選んで編集するだけ。',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: PenLine,
    title: 'セクション別コピー生成',
    desc: 'ファーストビュー〜フッターまで、全セクションのコピーをAIが一括生成。',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
  },
  {
    icon: Palette,
    title: '8種類のデザインテーマ',
    desc: 'Corporate/Minimal/Dark など8テーマ。HTMLエクスポートでそのまま使用可能。',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
]

export default function LpDashboardPage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const [projects, setProjects] = useState<LpProject[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    fetch('/api/lp/projects?limit=6')
      .then((r) => {
        if (!r.ok) throw new Error('取得に失敗しました')
        return r.json()
      })
      .then((d) => setProjects(d.projects || []))
      .catch(() => { toast.error('LPプロジェクト一覧の取得に失敗しました') })
      .finally(() => setLoading(false))
  }, [sessionStatus])

  const handleDelete = async (id: string) => {
    setDeleteTargetId(null)
    try {
      const res = await fetch(`/api/lp/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (e: any) {
      toast.error(e.message || '削除に失敗しました')
    }
  }

  if (sessionStatus === 'loading') {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-6">
        <LogIn className="w-12 h-12 text-cyan-400 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">ログインが必要です</h2>
        <p className="text-slate-400 text-sm mb-6">LP作成機能を使うにはログインしてください。</p>
        <button onClick={() => router.push('/auth/signin?callbackUrl=/lp')} className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition-colors">
          <LogIn className="w-4 h-4" /> Googleでログイン
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-cyan-950 via-cyan-900/50 to-slate-950 border-b border-cyan-900/30">
        <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">📄</span>
              <div>
                <p className="text-cyan-400 text-sm font-semibold tracking-widest uppercase">ドヤLP AI</p>
                <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
                  LPを、1分で設計する。
                </h1>
              </div>
            </div>
            <p className="text-slate-300 text-base md:text-lg max-w-2xl leading-relaxed mb-8">
              商品情報を入力するだけで、LP構成案・セクション別コピー・デザイン方針をAIが自動生成。
              HTMLエクスポートでそのまま公開、または制作会社への指示書として使用できます。
            </p>
            <Link
              href="/lp/new/input"
              className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-8 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-cyan-500/20"
            >
              <PlusCircle className="w-5 h-5" />
              新規LP作成を開始する
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
        {/* 最近のプロジェクト */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              最近のLPプロジェクト
            </h2>
            {projects.length > 0 && (
              <Link href="/lp/history" className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                すべて見る <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-32 bg-slate-800/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg mb-2">まだLPがありません</p>
              <p className="text-slate-500 text-sm mb-6">「新規LP作成」からLPを作ってみましょう</p>
              <Link
                href="/lp/new/input"
                className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6 py-3 rounded-lg transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                LP作成を始める
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => {
                const statusInfo = STATUS_LABELS[project.status] || STATUS_LABELS.draft
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-cyan-800/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate text-base">{project.name}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(project.createdAt).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <Link
                        href={`/lp/${project.id}`}
                        className="text-sm text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                      >
                        開く <ArrowRight className="w-3 h-3" />
                      </Link>
                      <button
                        onClick={() => setDeleteTargetId(project.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </section>

        {/* 機能紹介 */}
        <section>
          <h2 className="text-xl font-bold text-white mb-6">4ステップでLP設計が完了</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-4 p-5 bg-slate-900 rounded-xl border border-slate-800"
              >
                <div className={`p-2.5 rounded-lg ${feature.bg} flex-shrink-0`}>
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-500 font-bold">Step {i + 1}</span>
                  </div>
                  <h3 className="font-bold text-white text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      {/* 削除確認モーダル */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="font-bold text-white mb-2">LPの削除</h3>
            <p className="text-sm text-slate-400 mb-6">このLPを削除しますか？この操作は取り消せません。</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(deleteTargetId)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-lg transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
