'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Send, Copy, Check, Mail, ExternalLink, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SharePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    fetch(`/api/interviewx/projects/${projectId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setProject(data.project)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  const handleShare = async () => {
    setSharing(true)
    try {
      const res = await fetch(`/api/interviewx/projects/${projectId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendEmail: !!project?.respondentEmail }),
      })
      const data = await res.json()
      if (data.success) {
        setProject((prev: any) => ({ ...prev, shareUrl: data.shareUrl, status: 'SHARED' }))
        if (data.emailSent) setEmailSent(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSharing(false)
    }
  }

  const copyUrl = () => {
    const url = project?.shareUrl || `${window.location.origin}/interviewx/respond/${project?.shareToken}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
      <div className="max-w-2xl mx-auto px-6 py-12 text-center">
        <p className="text-slate-500">プロジェクトが見つかりませんでした。</p>
      </div>
    )
  }

  const shareUrl = project.shareUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/interviewx/respond/${project.shareToken}`
  const isShared = project.status !== 'DRAFT' && project.status !== 'QUESTIONS_READY'

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link href={`/interviewx/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        プロジェクトに戻る
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">共有設定</h1>
      <p className="text-slate-500 mb-8">アンケートの共有URLを生成し、回答者に送信します。</p>

      {/* プロジェクト情報 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">プロジェクト情報</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-slate-500">タイトル</span>
            <span className="font-medium text-slate-900">{project.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">質問数</span>
            <span className="font-medium text-slate-900">{project.questions?.length || 0}問</span>
          </div>
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
        </div>
      </div>

      {/* 共有URL */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">共有URL</h2>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-700 font-mono truncate border border-slate-200">
            {shareUrl}
          </div>
          <button
            onClick={copyUrl}
            className="flex-shrink-0 p-3 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
            title="URLをコピー"
          >
            {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-slate-600" />}
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-3 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
            title="プレビュー"
          >
            <ExternalLink className="w-5 h-5 text-slate-600" />
          </a>
        </div>

        {copied && (
          <p className="text-sm text-green-600 font-medium mb-4">URLをコピーしました！</p>
        )}

        {!isShared ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              下のボタンを押すと、共有URLが有効になります。
              {project.respondentEmail && 'メールでも回答者に通知されます。'}
            </p>
            <button
              onClick={handleShare}
              disabled={sharing || (project.questions?.length || 0) === 0}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold hover:from-indigo-600 hover:to-violet-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sharing ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  送信中...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  アンケートを共有する
                </>
              )}
            </button>
            {(project.questions?.length || 0) === 0 && (
              <p className="text-sm text-amber-600">※ 質問を生成してから共有してください。</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              <span className="font-medium">共有済み</span>
            </div>
            {emailSent && (
              <div className="flex items-center gap-2 text-indigo-600">
                <Mail className="w-5 h-5" />
                <span className="text-sm">メールを送信しました</span>
              </div>
            )}
            <p className="text-sm text-slate-500">
              回答者がアンケートに回答すると、自動的に通知されます。
            </p>
          </div>
        )}
      </div>

      {/* ステータス */}
      {isShared && (
        <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-6">
          <h2 className="text-sm font-bold text-indigo-700 mb-3">回答ステータス</h2>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              project.status === 'ANSWERED' || project.status === 'GENERATING' || project.status === 'REVIEW'
                ? 'bg-green-500' : 'bg-amber-500 animate-pulse'
            }`} />
            <span className="text-sm font-medium text-slate-700">
              {project.status === 'SHARED' && '回答待ち...'}
              {project.status === 'RESPONDING' && '回答中...'}
              {project.status === 'ANSWERED' && '回答完了！記事を生成できます。'}
              {['GENERATING', 'REVIEW', 'FEEDBACK', 'FINALIZING', 'COMPLETED'].includes(project.status) && '回答完了済み'}
            </span>
          </div>
          {(project.status === 'ANSWERED' || project.status === 'REVIEW') && (
            <button
              onClick={() => router.push(`/interviewx/projects/${projectId}/draft`)}
              className="mt-4 w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
            >
              記事を確認する →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
