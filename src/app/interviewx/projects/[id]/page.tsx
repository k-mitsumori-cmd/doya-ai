'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, MessageSquare, Send, FileText, CheckCircle, Wand2,
  Share2, Eye, Download, Trash2, Loader2, ClipboardList, Search,
  Building2, Calendar, ArrowRight
} from 'lucide-react'

const STATUS_FLOW = [
  { key: 'DRAFT', label: '下書き', icon: FileText, color: 'text-slate-500' },
  { key: 'QUESTIONS_READY', label: '質問準備完了', icon: ClipboardList, color: 'text-blue-600' },
  { key: 'SHARED', label: '共有済み', icon: Send, color: 'text-indigo-600' },
  { key: 'RESPONDING', label: 'ヒヤリング中', icon: MessageSquare, color: 'text-amber-600' },
  { key: 'ANSWERED', label: '回答完了', icon: CheckCircle, color: 'text-green-600' },
  { key: 'SUMMARIZED', label: '要約済み', icon: Wand2, color: 'text-purple-600' },
  { key: 'COMPLETED', label: '完了', icon: CheckCircle, color: 'text-emerald-600' },
]

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/interviewx/projects/${projectId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setProject(data.project)
        else setError(data.error || 'プロジェクトの取得に失敗しました')
      })
      .catch(() => setError('通信エラーが発生しました'))
      .finally(() => setLoading(false))
  }, [projectId])

  const handleDelete = async () => {
    if (!confirm('このヒヤリングを削除しますか？この操作は元に戻せません。')) return
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
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <p className="text-slate-500">{error || 'ヒヤリングが見つかりませんでした。'}</p>
        <Link href="/interviewx" className="text-indigo-600 hover:underline mt-4 inline-block">ダッシュボードに戻る</Link>
      </div>
    )
  }

  const statusMap: Record<string, string> = {
    GENERATING: 'ANSWERED',
    REVIEW: 'SUMMARIZED',
    FEEDBACK: 'SUMMARIZED',
    FINALIZING: 'SUMMARIZED',
  }
  const mappedStatus = statusMap[project.status] || project.status
  const currentIdx = STATUS_FLOW.findIndex(s => s.key === mappedStatus)
  const companyAnalysis = project.companyAnalysis as any

  const actions = [
    {
      label: '質問を編集',
      description: 'AI生成された質問を確認・編集',
      href: `/interviewx/projects/${projectId}/questions`,
      icon: ClipboardList,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      show: true,
    },
    {
      label: 'ヒヤリングを共有',
      description: '回答者にチャットURLを送信',
      href: `/interviewx/projects/${projectId}/share`,
      icon: Share2,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      show: ['QUESTIONS_READY', 'SHARED', 'RESPONDING'].includes(mappedStatus) || currentIdx >= 1,
    },
    {
      label: '回答を確認',
      description: 'ヒヤリング結果を閲覧',
      href: `/interviewx/projects/${projectId}/responses`,
      icon: Eye,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      show: currentIdx >= 4,
    },
    {
      label: '要約を確認',
      description: 'AIが生成した要約を確認・エクスポート',
      href: `/interviewx/projects/${projectId}/draft`,
      icon: FileText,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      show: currentIdx >= 4,
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/interviewx" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        ダッシュボードに戻る
      </Link>

      {/* プロジェクトヘッダー */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">{project.title}</h1>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {project.companyName && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {project.companyName}
              </span>
            )}
            {project.template?.name && (
              <span className="flex items-center gap-1">
                <Wand2 className="w-3 h-3" />
                {project.template.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              更新日：{new Date(project.updatedAt).toLocaleDateString('ja-JP')}
            </span>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
          title="ヒヤリングを削除"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

      {/* ステータスタイムライン */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">進捗状況</h2>
        <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
          {STATUS_FLOW.map((step, idx) => {
            const Icon = step.icon
            const isActive = idx === currentIdx
            const isDone = idx < currentIdx
            return (
              <div key={step.key} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                  isActive ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' :
                  isDone ? 'bg-green-50 text-green-600' :
                  'bg-slate-50 text-slate-400'
                }`}>
                  {isDone ? <CheckCircle className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  {step.label}
                </div>
                {idx < STATUS_FLOW.length - 1 && (
                  <ArrowRight className={`w-3 h-3 mx-0.5 flex-shrink-0 ${isDone ? 'text-green-400' : 'text-slate-300'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 2カラムレイアウト */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 左: ヒヤリング情報 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center">
              <FileText className="w-3 h-3 text-blue-600" />
            </div>
            ヒヤリング情報
          </h2>
          <div className="space-y-3 text-sm">
            {project.respondentName && (
              <div className="flex justify-between">
                <span className="text-slate-500">回答者</span>
                <span className="font-medium text-slate-900">{project.respondentName}</span>
              </div>
            )}
            {project.respondentEmail && (
              <div className="flex justify-between">
                <span className="text-slate-500">メール</span>
                <span className="font-medium text-slate-900">{project.respondentEmail}</span>
              </div>
            )}
            {project.purpose && (
              <div>
                <span className="text-slate-500 block mb-0.5">目的</span>
                <span className="font-medium text-slate-900">{project.purpose}</span>
              </div>
            )}
            {project.targetAudience && (
              <div>
                <span className="text-slate-500 block mb-0.5">対象者</span>
                <span className="font-medium text-slate-900">{project.targetAudience}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">質問数</span>
              <span className="font-medium text-slate-900">{project.questions?.length || 0}問</span>
            </div>
            {project.companyUrl && (
              <div className="flex justify-between">
                <span className="text-slate-500">URL</span>
                <span className="font-medium text-slate-900 truncate max-w-[200px]">{project.companyUrl}</span>
              </div>
            )}
          </div>

          {/* URL調査結果 */}
          {companyAnalysis && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-500" />
                URL調査結果
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                {companyAnalysis.companyName && (
                  <span><span className="font-medium text-slate-700">企業:</span> {companyAnalysis.companyName}</span>
                )}
                {companyAnalysis.businessDescription && (
                  <span><span className="font-medium text-slate-700">事業:</span> {companyAnalysis.businessDescription}</span>
                )}
                {companyAnalysis.industry && (
                  <span><span className="font-medium text-slate-700">業界:</span> {companyAnalysis.industry}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右: アクション */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber-100 flex items-center justify-center">
              <Wand2 className="w-3 h-3 text-amber-600" />
            </div>
            アクション
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {actions.filter(a => a.show).map(action => {
              const Icon = action.icon
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-all text-center group"
                >
                  <div className={`w-10 h-10 rounded-lg ${action.iconBg} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                    <Icon className={`w-5 h-5 ${action.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{action.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{action.description}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* エクスポート */}
      {['COMPLETED', 'SUMMARIZED'].includes(mappedStatus) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center">
              <Download className="w-3 h-3 text-emerald-600" />
            </div>
            エクスポート
          </h2>
          <div className="flex gap-3">
            <a
              href={`/api/interviewx/projects/${projectId}/export/html`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              HTMLダウンロード
            </a>
            <a
              href={`/api/interviewx/projects/${projectId}/export/markdown`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Markdownダウンロード
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
