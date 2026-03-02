'use client'
// ============================================
// ドヤムービーAI - ダッシュボード / LP
// ============================================
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import type { MovieProjectData } from '@/lib/movie/types'

const STEPS = [
  { icon: '📝', title: '商品情報を入力', desc: '商品名・特徴・ターゲットを入力するだけ。URLから自動解析も可能。' },
  { icon: '🤖', title: 'AIが企画を生成', desc: '3パターンの動画企画をAIが自動生成。ストーリーライン・シーン構成付き。' },
  { icon: '✏️', title: '編集・カスタマイズ', desc: 'テキスト・背景・BGMを自由に編集。リアルタイムプレビューで確認。' },
  { icon: '🎬', title: 'ダウンロード', desc: 'MP4またはGIF形式でダウンロード。YouTube・TikTokへそのまま投稿可能。' },
]

const PLATFORMS = [
  { name: 'YouTube', icon: '▶️' },
  { name: 'TikTok', icon: '🎵' },
  { name: 'Instagram', icon: '📸' },
  { name: 'X (Twitter)', icon: '🐦' },
  { name: 'Facebook', icon: '📘' },
  { name: 'LINE', icon: '💬' },
]

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-black text-white mb-1">{value}</div>
      <div className="text-rose-300/70 text-sm">{label}</div>
    </div>
  )
}

function ProjectCard({ project }: { project: MovieProjectData }) {
  const statusLabel = {
    draft: '下書き',
    planning: '企画中',
    editing: '編集中',
    rendering: 'レンダリング中',
    completed: '完成',
    failed: 'エラー',
  }[project.status] || project.status

  const statusColor = {
    draft: 'text-slate-400 bg-slate-800',
    planning: 'text-blue-300 bg-blue-900/40',
    editing: 'text-amber-300 bg-amber-900/40',
    rendering: 'text-purple-300 bg-purple-900/40',
    completed: 'text-emerald-300 bg-emerald-900/40',
    failed: 'text-red-300 bg-red-900/40',
  }[project.status] || 'text-slate-400 bg-slate-800'

  return (
    <Link href={`/movie/${project.id}`}>
      <div className="rounded-xl border border-rose-900/30 bg-slate-900/60 hover:bg-rose-950/40 transition-all group cursor-pointer overflow-hidden">
        {/* サムネイル */}
        <div className="aspect-video bg-gradient-to-br from-rose-900/40 to-pink-900/40 flex items-center justify-center relative">
          {project.thumbnailUrl ? (
            <img src={project.thumbnailUrl} alt={project.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl opacity-40">🎬</span>
          )}
          {project.status === 'rendering' && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="text-white text-sm animate-pulse">レンダリング中...</div>
            </div>
          )}
        </div>
        {/* 情報 */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-white text-sm font-semibold truncate group-hover:text-rose-200 transition-colors">
              {project.name}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <div className="text-rose-300/50 text-xs">
            {new Date(project.updatedAt).toLocaleDateString('ja-JP')}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function MovieDashboard() {
  const { data: session } = useSession()
  const user = session?.user as any
  const isLoggedIn = !!user?.id
  const [projects, setProjects] = useState<MovieProjectData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) return
    setLoading(true)
    fetch('/api/movie/projects?limit=6')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { if (d.projects) setProjects(d.projects) })
      .catch(() => {/* silent fail - projects just won't show */})
      .finally(() => setLoading(false))
  }, [isLoggedIn])

  return (
    <div className="min-h-full">
      {/* ヒーローセクション */}
      <section className="relative px-6 py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-rose-950/30 to-transparent pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 bg-rose-500/20 border border-rose-500/30 rounded-full px-4 py-1.5 mb-6">
              <span className="text-rose-300 text-sm font-semibold">🎬 NEW</span>
              <span className="text-rose-200/70 text-sm">AIで動画広告を自動生成</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight">
              動画広告を、<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-400">
                10分で作る。
              </span>
            </h1>
            <p className="text-rose-100/70 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
              商品情報を入力するだけで、AIが企画・シーン・ナレーションを自動生成。<br className="hidden md:block" />
              YouTube・TikTok・Instagramに対応したプロ品質の動画が完成。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/movie/new/concept"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all shadow-lg shadow-rose-500/30"
                style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
              >
                <span className="material-symbols-outlined">add_circle</span>
                無料で動画を作る
              </Link>
              <Link
                href="/movie/templates"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-rose-200 text-lg border border-rose-500/30 hover:bg-rose-900/30 transition-all"
              >
                <span className="material-symbols-outlined">grid_view</span>
                テンプレートを見る
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 統計 */}
      <section className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-rose-900/30 bg-rose-950/20 p-6 grid grid-cols-3 gap-6">
            <StatCard value="10分" label="平均作成時間" />
            <StatCard value="9種類" label="対応プラットフォーム" />
            <StatCard value="15+" label="テンプレート数" />
          </div>
        </div>
      </section>

      {/* 最近のプロジェクト（ログイン時のみ） */}
      {isLoggedIn && (
        <section className="px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">最近のプロジェクト</h2>
              <Link href="/movie/history" className="text-rose-300 text-sm hover:text-rose-200 transition-colors">
                すべて見る →
              </Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-rose-900/30 bg-slate-900/60 animate-pulse aspect-[4/3]" />
                ))}
              </div>
            ) : projects.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {projects.map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-rose-900/40 p-8 text-center">
                <div className="text-4xl mb-3">🎬</div>
                <p className="text-rose-200/60 mb-4">まだ動画プロジェクトがありません</p>
                <Link
                  href="/movie/new/concept"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
                >
                  最初の動画を作る
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 使い方ステップ */}
      <section className="px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-white font-black text-2xl text-center mb-8">4ステップで動画完成</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="flex gap-4 rounded-xl border border-rose-900/30 bg-slate-900/40 p-5"
              >
                <div className="text-3xl flex-shrink-0">{step.icon}</div>
                <div>
                  <div className="text-rose-300 text-xs font-bold mb-1">STEP {i + 1}</div>
                  <h3 className="text-white font-bold mb-1">{step.title}</h3>
                  <p className="text-rose-200/60 text-sm">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 対応プラットフォーム */}
      <section className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-white font-bold text-lg text-center mb-6">対応プラットフォーム</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {PLATFORMS.map(p => (
              <div
                key={p.name}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-rose-900/30 bg-slate-900/40 text-rose-200/80 text-sm"
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      {!isLoggedIn && (
        <section className="px-6 py-12">
          <div className="max-w-2xl mx-auto rounded-2xl border border-rose-500/30 bg-rose-950/30 p-8 text-center">
            <h2 className="text-white font-black text-2xl mb-3">無料で動画広告を作ってみる</h2>
            <p className="text-rose-200/70 mb-6">登録不要・月3本まで無料。今すぐ始められます。</p>
            <Link
              href="/movie/new/concept"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all shadow-lg shadow-rose-500/30"
              style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
            >
              <span className="material-symbols-outlined">add_circle</span>
              無料で動画を作る
            </Link>
          </div>
        </section>
      )}

      <div className="h-12" />
    </div>
  )
}
