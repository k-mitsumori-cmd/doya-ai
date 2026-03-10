'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Wand2, Loader2, FileText, Download, MessageSquare,
  ShieldCheck, RefreshCw, Copy, Check
} from 'lucide-react'

export default function DraftPage() {
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<any>(null)
  const [draft, setDraft] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [progress, setProgress] = useState('')
  const [copied, setCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchData()
  }, [projectId])

  const fetchData = async () => {
    try {
      const [projRes, draftRes] = await Promise.all([
        fetch(`/api/interviewx/projects/${projectId}`).then(r => r.json()),
        fetch(`/api/interviewx/projects/${projectId}/drafts`).then(r => r.json()),
      ])
      if (projRes.success) setProject(projRes.project)
      if (draftRes.success && draftRes.drafts?.length > 0) {
        setDraft(draftRes.drafts[0])
      }
    } catch {}
    setLoading(false)
  }

  const generateArticle = async () => {
    setGenerating(true)
    setStreamText('')
    setProgress('記事生成を開始...')
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
      setProgress('記事生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  const copyContent = () => {
    const content = draft?.content || streamText
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 簡易Markdownレンダラー
  const renderMarkdown = (md: string) => {
    return md
      .replace(/^### (.+)/gm, '<h3 class="text-lg font-bold text-slate-900 mt-6 mb-2">$1</h3>')
      .replace(/^## (.+)/gm, '<h2 class="text-xl font-bold text-slate-900 mt-8 mb-3">$1</h2>')
      .replace(/^# (.+)/gm, '<h1 class="text-2xl font-black text-slate-900 mt-4 mb-4">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/「(.+?)」/g, '<span class="text-indigo-700 font-medium">「$1」</span>')
      .replace(/^- (.+)/gm, '<li class="ml-4 list-disc text-slate-700">$1</li>')
      .replace(/\n\n/g, '</p><p class="text-slate-700 leading-relaxed mb-4">')
      .replace(/^(?!<[hlps])/gm, '')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const content = draft?.content || streamText
  const canGenerate = project && ['ANSWERED', 'REVIEW', 'FEEDBACK', 'GENERATING'].includes(project.status)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href={`/interviewx/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        プロジェクトに戻る
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">記事プレビュー</h1>
          {draft && (
            <p className="text-slate-500 mt-1">
              バージョン {draft.version} ・ {draft.wordCount?.toLocaleString()}文字 ・ 約{draft.readingTime}分で読めます
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canGenerate && (
            <button
              onClick={generateArticle}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold hover:from-indigo-600 hover:to-violet-600 transition-all disabled:opacity-50 text-sm"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : draft ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {draft ? '再生成' : '記事を生成'}
            </button>
          )}
        </div>
      </div>

      {/* 生成中プログレス */}
      {generating && progress && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
            <p className="text-sm font-medium text-indigo-700">{progress}</p>
          </div>
        </div>
      )}

      {/* 記事コンテンツ */}
      {content ? (
        <>
          {/* ツールバー */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={copyContent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'コピーしました' : 'コピー'}
            </button>
            <a
              href={`/api/interviewx/projects/${projectId}/export/markdown`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Markdown
            </a>
            <a
              href={`/api/interviewx/projects/${projectId}/export/html`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              HTML
            </a>
            <div className="flex-1" />
            <Link
              href={`/interviewx/projects/${projectId}/feedback`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 text-xs font-bold hover:bg-orange-200 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              フィードバック
            </Link>
            <Link
              href={`/interviewx/projects/${projectId}/checks`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-200 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              品質チェック
            </Link>
          </div>

          {/* 記事本文 */}
          <div
            ref={contentRef}
            className="bg-white rounded-2xl border border-slate-200 p-8 prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />

          {/* ドラフト情報 */}
          {draft && (
            <div className="mt-6 flex items-center gap-4 text-xs text-slate-400">
              <span>v{draft.version}</span>
              <span>{draft.wordCount?.toLocaleString()}文字</span>
              <span>ステータス: {draft.status}</span>
              <span>{new Date(draft.createdAt).toLocaleString('ja-JP')}</span>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <FileText className="w-16 h-16 text-indigo-200 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">まだ記事がありません</h2>
          <p className="text-slate-500 mb-6">
            {canGenerate
              ? '回答データをもとにAIで記事を自動生成できます。'
              : '回答者がアンケートに回答すると、記事を生成できます。'}
          </p>
          {canGenerate && (
            <button
              onClick={generateArticle}
              disabled={generating}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold"
            >
              <Wand2 className="w-5 h-5" />
              記事を自動生成
            </button>
          )}
        </div>
      )}
    </div>
  )
}
