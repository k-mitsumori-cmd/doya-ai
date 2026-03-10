'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, FileText, Clock, CheckCircle, Send, ArrowRight } from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '下書き', color: 'bg-slate-100 text-slate-600' },
  QUESTIONS_READY: { label: '質問準備完了', color: 'bg-blue-100 text-blue-700' },
  SHARED: { label: '共有済み', color: 'bg-indigo-100 text-indigo-700' },
  RESPONDING: { label: '回答中', color: 'bg-amber-100 text-amber-700' },
  ANSWERED: { label: '回答完了', color: 'bg-green-100 text-green-700' },
  GENERATING: { label: '記事生成中', color: 'bg-purple-100 text-purple-700' },
  REVIEW: { label: 'レビュー中', color: 'bg-cyan-100 text-cyan-700' },
  FEEDBACK: { label: 'フィードバック待ち', color: 'bg-orange-100 text-orange-700' },
  FINALIZING: { label: '最終チェック', color: 'bg-violet-100 text-violet-700' },
  COMPLETED: { label: '完了', color: 'bg-emerald-100 text-emerald-700' },
}

export default function InterviewXDashboard() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/interviewx/projects')
      .then(r => r.json())
      .then(data => {
        if (data.success) setProjects(data.projects || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const inProgress = projects.filter(p => !['COMPLETED', 'DRAFT'].includes(p.status)).length
  const completed = projects.filter(p => p.status === 'COMPLETED').length

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black">
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              インタビューAI-X
            </span>
          </h1>
          <p className="text-slate-500 mt-1">アンケートを送るだけで、インタビュー記事が完成</p>
        </div>
        <Link
          href="/interviewx/new"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold hover:from-indigo-600 hover:to-violet-600 transition-all shadow-lg shadow-indigo-500/25"
        >
          <Plus className="w-5 h-5" />
          新規作成
        </Link>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{projects.length}</p>
              <p className="text-xs text-slate-500 font-medium">全プロジェクト</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{inProgress}</p>
              <p className="text-xs text-slate-500 font-medium">進行中</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{completed}</p>
              <p className="text-xs text-slate-500 font-medium">完了</p>
            </div>
          </div>
        </div>
      </div>

      {/* プロジェクト一覧 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <Send className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">まだプロジェクトがありません</h2>
          <p className="text-slate-500 mb-6">テンプレートを選んで、最初のインタビュー記事を作成しましょう。</p>
          <Link
            href="/interviewx/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold"
          >
            <Plus className="w-5 h-5" />
            最初のプロジェクトを作成
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(project => {
            const statusInfo = STATUS_LABELS[project.status] || STATUS_LABELS.DRAFT
            return (
              <Link
                key={project.id}
                href={`/interviewx/projects/${project.id}`}
                className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-slate-900 truncate">{project.title}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      {project.respondentName && <span>回答者: {project.respondentName}</span>}
                      {project.template?.name && <span>{project.template.name}</span>}
                      <span>{new Date(project.updatedAt).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
