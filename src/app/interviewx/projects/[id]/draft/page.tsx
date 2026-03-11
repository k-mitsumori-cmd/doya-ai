'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Wand2, Loader2, FileText, Download,
  RefreshCw, Copy, Check, CheckCircle, Info, Sparkles
} from 'lucide-react'

export default function SummaryPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<any>(null)
  const [draft, setDraft] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [progress, setProgress] = useState('')
  const [copied, setCopied] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchData()
  }, [projectId])

  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const [projRes, draftRes] = await Promise.all([
        fetch(`/api/interviewx/projects/${projectId}`).then(r => r.json()),
        fetch(`/api/interviewx/projects/${projectId}/drafts`).then(r => r.json()),
      ])
      if (projRes.success) setProject(projRes.project)
      else setError(projRes.error || 'プロジェクトの取得に失敗しました')
      if (draftRes.success && draftRes.drafts?.length > 0) {
        setDraft(draftRes.drafts[0])
      }
    } catch {
      setError('通信エラーが発生しました')
    }
    setLoading(false)
  }

  const generateSummary = async () => {
    setGenerating(true)
    setStreamText('')
    setProgress('要約生成を開始...')
    try {
      const res = await fetch(`/api/interviewx/projects/${projectId}/generate-article`, {
        method: 'POST',
      })
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'progress') setProgress(event.message)
            if (event.type === 'chunk') {
              fullText += event.text
              setStreamText(fullText)
            }
            if (event.type === 'done') {
              setProgress('')
              fetchData()
            }
            if (event.type === 'error') {
              setProgress(`エラー: ${event.message}`)
            }
          } catch {}
        }
      }
    } catch (e) {
      setProgress('要約生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  const handleFinalize = async () => {
    if (!confirm('このヒヤリングを完了にしますか？')) return
    setFinalizing(true)
    try {
      const res = await fetch(`/api/interviewx/projects/${projectId}/finalize`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        router.push(`/interviewx/projects/${projectId}`)
      } else {
        setError(data.error || '完了処理に失敗しました')
      }
    } catch {
      setError('完了処理に失敗しました')
    }
    setFinalizing(false)
  }

  const copyContent = () => {
    const content = draft?.content || streamText
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const renderMarkdown = (md: string) => {
    // まずHTMLエスケープしてからMarkdown変換
    const escaped = escapeHtml(md)
    return escaped
      .replace(/^### (.+)/gm, '<h3 class="text-base font-bold text-slate-900 mt-6 mb-2 flex items-center gap-2"><span class="w-1 h-5 bg-indigo-500 rounded-full inline-block"></span>$1</h3>')
      .replace(/^## (.+)/gm, '<h2 class="text-lg font-bold text-slate-900 mt-8 mb-3 flex items-center gap-2"><span class="w-1 h-5 bg-indigo-500 rounded-full inline-block"></span>$1</h2>')
      .replace(/^# (.+)/gm, '<h1 class="text-xl font-black text-slate-900 mt-4 mb-4">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
      .replace(/&gt; (.+)/gm, '<blockquote class="border-l-4 border-indigo-200 bg-slate-50 pl-4 py-3 my-4 text-sm text-slate-600 italic rounded-r-lg">$1</blockquote>')
      .replace(/^- \[x\] (.+)/gm, '<div class="flex items-start gap-2 my-1.5"><div class="w-4 h-4 mt-0.5 rounded border border-slate-300 flex-shrink-0 flex items-center justify-center"><svg class="w-3 h-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg></div><span class="text-sm text-slate-700">$1</span></div>')
      .replace(/^- \[ \] (.+)/gm, '<div class="flex items-start gap-2 my-1.5"><div class="w-4 h-4 mt-0.5 rounded border border-slate-300 flex-shrink-0"></div><span class="text-sm text-slate-700">$1</span></div>')
      .replace(/^- (.+)/gm, '<li class="ml-4 list-disc text-sm text-slate-700 my-1">$1</li>')
      .replace(/\n\n/g, '</p><p class="text-sm text-slate-700 leading-relaxed mb-3">')
      .replace(/^(?!<[hldbs])/gm, '')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const content = draft?.content || streamText
  const canGenerate = project && ['ANSWERED', 'SUMMARIZED', 'COMPLETED'].includes(project.status)
  const canFinalize = project && ['SUMMARIZED'].includes(project.status) && draft

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href={`/interviewx/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        プロジェクトに戻る
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">ヒヤリング要約</h1>
          <p className="text-sm text-slate-500 mt-0.5">{project?.title}</p>
        </div>
        <div className="flex items-center gap-2">
          {canGenerate && (
            <button
              onClick={generateSummary}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : draft ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {draft ? '要約を再生成' : '要約を生成'}
            </button>
          )}
          {content && (
            <>
              <a
                href={`/api/interviewx/projects/${projectId}/export/html`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                HTML
              </a>
              <a
                href={`/api/interviewx/projects/${projectId}/export/markdown`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Markdown
              </a>
            </>
          )}
          {canFinalize && (
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {finalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              完了にする
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* 生成中プログレス */}
      {generating && progress && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
            <p className="text-sm font-medium text-indigo-700">{progress}</p>
          </div>
        </div>
      )}

      {/* 要約コンテンツ */}
      {content ? (
        <>
          <div
            ref={contentRef}
            className="bg-white rounded-xl border border-slate-200 p-6 lg:p-8"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />

          {/* コピーボタン */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={copyContent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'コピーしました' : 'テキストをコピー'}
            </button>
            {draft && (
              <span className="text-xs text-slate-400">
                v{draft.version} ・ {draft.wordCount?.toLocaleString()}文字 ・ {new Date(draft.createdAt).toLocaleString('ja-JP')}
              </span>
            )}
          </div>
        </>
      ) : (
        /* 未生成状態 */
        <div>
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">まだ要約が生成されていません</h2>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
              {canGenerate
                ? '回答完了後に「要約を生成」ボタンで要約を作成できます。'
                : 'ヒヤリングが完了すると、要約を生成できます。'}
            </p>
            {canGenerate && (
              <button
                onClick={generateSummary}
                disabled={generating}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                要約を生成
              </button>
            )}
          </div>

          {/* ガイドカード */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-500" />
                要約のメリット
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                AIが回答内容を分析し、重要なポイントを数秒で抽出します。商談の振り返りや次のアクションプラン作成に活用できます。
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                生成のタイミング
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                ヒヤリングの全ステップが完了した後、いつでも生成が可能です。一度生成した要約は履歴からいつでも確認できます。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
