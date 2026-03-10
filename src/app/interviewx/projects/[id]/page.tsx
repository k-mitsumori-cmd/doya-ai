'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, MessageSquare, Send, FileText, CheckCircle, Wand2,
  Share2, Eye, Download, Trash2, Loader2, ClipboardList, ShieldCheck
} from 'lucide-react'

const STATUS_FLOW = [
  { key: 'DRAFT', label: '下書き', icon: FileText },
  { key: 'QUESTIONS_READY', label: '質問準備完了', icon: ClipboardList },
  { key: 'SHARED', label: '共有済み', icon: Send },
  { key: 'RESPONDING', label: '回答中', icon: MessageSquare },
  { key: 'ANSWERED', label: '回答完了', icon: CheckCircle },
  { key: 'GENERATING', label: '記事生成中', icon: Wand2 },
  { key: 'REVIEW', label: 'レビュー中', icon: Eye },
  { key: 'FEEDBACK', label: 'フィードバック', icon: MessageSquare },
  { key: 'FINALIZING', label: '最終チェック', icon: ShieldCheck },
  { key: 'COMPLETED', label: '完了', icon: CheckCircle },
]

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/interviewx/projects/${projectId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setProject(data.project)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  const handleDelete = async () => {
    if (!confirm('このプロジェクトを削除しますか？この操作は元に戻せません。')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/interviewx/projects/${projectId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) router.push('/interviewx')
    } catch {
      alert('削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-center">
        <p className="text-slate-500">プロジェクトが見つかりませんでした。</p>
        <Link href="/interviewx" className="text-indigo-600 hover:underline mt-4 inline-block">ダッシュボードに戻る</Link>
      </div>
    )
  }

  const currentIdx = STATUS_FLOW.findIndex(s => s.key === project.status)

  // アクションカード
  const actions = [
    {
      label: '質問を編集',
      description: 'AI生成された質問を確認・編集',
      href: `/interviewx/projects/${projectId}/questions`,
      icon: ClipboardList,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      show: true,
    },
    {
      label: 'アンケートを共有',
      description: '回答者に共有URLを送信',
      href: `/interviewx/projects/${projectId}/share`,
      icon: Share2,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      show: ['QUESTIONS_READY', 'SHARED', 'RESPONDING'].includes(project.status) || currentIdx >= 1,
    },
    {
      label: '回答を確認',
      description: '回答者のアンケート回答を閲覧',
      href: `/interviewx/projects/${projectId}/responses`,
      icon: Eye,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      show: currentIdx >= 4,
    },
    {
      label: '記事を確認',
      description: '生成された記事をプレビュー',
      href: `/interviewx/projects/${projectId}/draft`,
      icon: FileText,
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      show: currentIdx >= 6,
    },
    {
      label: 'フィードバック',
      description: '記事への修正依頼を管理',
      href: `/interviewx/projects/${projectId}/feedback`,
      icon: MessageSquare,
      color: 'bg-orange-50 text-orange-700 border-orange-200',
      show: currentIdx >= 6,
    },
    {
      label: '品質チェック',
      description: 'AIによる品質チェック結果',
      href: `/interviewx/projects/${projectId}/checks`,
      icon: ShieldCheck,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      show: currentIdx >= 6,
    },
  ]

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/interviewx" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        ダッシュボードに戻る
      </Link>

      {/* プロジェクトヘッダー */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{project.title}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            {project.companyName && <span>{project.companyName}</span>}
            {project.template?.name && <span>{project.template.name}</span>}
            <span>{new Date(project.updatedAt).toLocaleDateString('ja-JP')}</span>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
          title="プロジェクトを削除"
        >
          {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
        </button>
      </div>

      {/* ステータスタイムライン */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">進捗状況</h2>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STATUS_FLOW.map((step, idx) => {
            const Icon = step.icon
            const isActive = idx === currentIdx
            const isDone = idx < currentIdx
            return (
              <div key={step.key} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  isActive ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500/30' :
                  isDone ? 'bg-green-50 text-green-600' :
                  'bg-slate-50 text-slate-400'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {step.label}
                </div>
                {idx < STATUS_FLOW.length - 1 && (
                  <div className={`w-4 h-0.5 mx-0.5 ${isDone ? 'bg-green-300' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* プロジェクト情報 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">プロジェクト情報</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {project.respondentName && (
            <div>
              <span className="text-slate-500">回答者</span>
              <p className="font-medium text-slate-900">{project.respondentName}</p>
            </div>
          )}
          {project.respondentEmail && (
            <div>
              <span className="text-slate-500">メール</span>
              <p className="font-medium text-slate-900">{project.respondentEmail}</p>
            </div>
          )}
          {project.purpose && (
            <div className="col-span-2">
              <span className="text-slate-500">目的</span>
              <p className="font-medium text-slate-900">{project.purpose}</p>
            </div>
          )}
          {project.targetAudience && (
            <div className="col-span-2">
              <span className="text-slate-500">想定読者</span>
              <p className="font-medium text-slate-900">{project.targetAudience}</p>
            </div>
          )}
          <div>
            <span className="text-slate-500">質問数</span>
            <p className="font-medium text-slate-900">{project.questions?.length || 0}問</p>
          </div>
          <div>
            <span className="text-slate-500">目標文字数</span>
            <p className="font-medium text-slate-900">{project.wordCountTarget?.toLocaleString() || 3000}文字</p>
          </div>
        </div>
      </div>

      {/* アクション */}
      <div className="space-y-3 mb-8">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">アクション</h2>
        {actions.filter(a => a.show).map(action => {
          const Icon = action.icon
          return (
            <Link
              key={action.label}
              href={action.href}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${action.color}`}
            >
              <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold">{action.label}</p>
                <p className="text-xs opacity-75">{action.description}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* エクスポート */}
      {project.status === 'COMPLETED' && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6">
          <h2 className="text-sm font-bold text-emerald-700 mb-3 flex items-center gap-2">
            <Download className="w-4 h-4" />
            エクスポート
          </h2>
          <div className="flex gap-3">
            <a
              href={`/api/interviewx/projects/${projectId}/export/html`}
              className="flex-1 py-3 text-center rounded-xl bg-white border border-emerald-300 font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              HTMLダウンロード
            </a>
            <a
              href={`/api/interviewx/projects/${projectId}/export/markdown`}
              className="flex-1 py-3 text-center rounded-xl bg-white border border-emerald-300 font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              Markdownダウンロード
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
