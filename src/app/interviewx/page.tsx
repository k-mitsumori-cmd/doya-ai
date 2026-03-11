'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus, FileText, Clock, CheckCircle, Send, ArrowRight,
  ChevronRight, User, Calendar, Tag
} from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  DRAFT: { label: '下書き', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  QUESTIONS_READY: { label: '質問準備完了', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  SHARED: { label: '共有済み', color: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  RESPONDING: { label: 'ヒヤリング中', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  ANSWERED: { label: '回答完了', color: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  SUMMARIZED: { label: '要約済み', color: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
  COMPLETED: { label: '完了', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
}

export default function InterviewXDashboard() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  useEffect(() => {
    fetch('/api/interviewx/projects')
      .then(r => r.json())
      .then(data => {
        if (data.success) setProjects(data.projects || [])
        else setError('プロジェクトの取得に失敗しました')
      })
      .catch(() => setError('通信エラーが発生しました'))
      .finally(() => setLoading(false))
  }, [])

  const inProgress = projects.filter(p => !['COMPLETED', 'DRAFT'].includes(p.status)).length
  const completed = projects.filter(p => p.status === 'COMPLETED').length

  const filtered = projects.filter(p => {
    if (filter === 'active') return !['COMPLETED', 'DRAFT'].includes(p.status)
    if (filter === 'completed') return p.status === 'COMPLETED'
    return true
  })

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            ドヤヒヤリングAI
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">AIチャットでヒヤリング、要約まで自動生成</p>
        </div>
        <Link
          href="/interviewx/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          新規プロジェクト作成
        </Link>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">合計プロジェクト</p>
              <p className="text-2xl font-black text-slate-900">{projects.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">進行中</p>
              <p className="text-2xl font-black text-slate-900">{inProgress}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">完了済み</p>
              <p className="text-2xl font-black text-slate-900">{completed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* プロジェクト一覧ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-900">最近のヒヤリングプロジェクト</h2>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {[
            { key: 'all' as const, label: 'すべて' },
            { key: 'active' as const, label: '進行中' },
            { key: 'completed' as const, label: '完了' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                filter === f.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* プロジェクト一覧 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">まだヒヤリングがありません</h2>
          <p className="text-sm text-slate-500 mb-6">カテゴリを選んで、最初のヒヤリングを始めましょう。</p>
          <Link
            href="/interviewx/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            最初のヒヤリングを作成
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {filtered.map((project, idx) => {
            const statusInfo = STATUS_LABELS[project.status] || STATUS_LABELS.DRAFT
            return (
              <Link
                key={project.id}
                href={`/interviewx/projects/${project.id}`}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group ${
                  idx > 0 ? 'border-t border-slate-100' : ''
                }`}
              >
                {/* ステータスドット */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusInfo.dot}`} />

                {/* メイン情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-0.5">
                    <h3 className="font-bold text-sm text-slate-900 truncate">{project.title}</h3>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {project.respondentName && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {project.respondentName}
                      </span>
                    )}
                    {project.template?.name && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {project.template.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(project.updatedAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </div>

                {/* 矢印 */}
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
              </Link>
            )
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              該当するプロジェクトがありません
            </div>
          )}
        </div>
      )}
    </div>
  )
}
