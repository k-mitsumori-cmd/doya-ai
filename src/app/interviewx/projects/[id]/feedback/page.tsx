'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { MessageSquare, Send, Wand2, ArrowLeft, User, Building2, Bot } from 'lucide-react'
import Link from 'next/link'

const FEEDBACK_CATEGORIES = [
  { value: 'FACT_CORRECTION', label: '事実の訂正' },
  { value: 'TONE', label: 'トーンの調整' },
  { value: 'ADDITION', label: '内容の追加' },
  { value: 'DELETION', label: '内容の削除' },
  { value: 'GENERAL', label: 'その他' },
]

const AUTHOR_ICONS: Record<string, typeof User> = {
  COMPANY: Building2,
  RESPONDENT: User,
  AI: Bot,
}

export default function FeedbackPage() {
  const params = useParams()
  const projectId = params.id as string

  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyProgress, setApplyProgress] = useState('')

  const [content, setContent] = useState('')
  const [category, setCategory] = useState('GENERAL')
  const [section, setSection] = useState('')

  useEffect(() => {
    fetchFeedbacks()
  }, [projectId])

  const fetchFeedbacks = () => {
    fetch(`/api/interviewx/projects/${projectId}/feedbacks`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setFeedbacks(data.feedbacks)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const submitFeedback = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/interviewx/projects/${projectId}/feedbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), category, section: section.trim() || null }),
      })
      const data = await res.json()
      if (data.success) {
        setFeedbacks(prev => [data.feedback, ...prev])
        setContent('')
        setSection('')
        setCategory('GENERAL')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const applyFeedbacks = async () => {
    setApplying(true)
    setApplyProgress('フィードバックを適用中...')
    try {
      const res = await fetch(`/api/interviewx/projects/${projectId}/apply-feedback`, { method: 'POST' })
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

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
            if (event.type === 'progress') setApplyProgress(event.message)
            if (event.type === 'done') {
              setApplyProgress('フィードバック適用完了！新しいバージョンが作成されました。')
              fetchFeedbacks()
            }
            if (event.type === 'error') setApplyProgress(`エラー: ${event.message}`)
          } catch {}
        }
      }
    } catch (e) {
      setApplyProgress('フィードバック適用に失敗しました')
    } finally {
      setApplying(false)
    }
  }

  const pendingCount = feedbacks.filter(f => !f.applied).length

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href={`/interviewx/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        プロジェクトに戻る
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">フィードバック</h1>
          <p className="text-slate-500 mt-1">記事への修正依頼やコメントを管理します。</p>
        </div>
        {pendingCount > 0 && (
          <button
            onClick={applyFeedbacks}
            disabled={applying}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold hover:from-indigo-600 hover:to-violet-600 transition-all disabled:opacity-50"
          >
            {applying ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            AIで{pendingCount}件を適用
          </button>
        )}
      </div>

      {applying && applyProgress && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-indigo-700">{applyProgress}</p>
        </div>
      )}

      {/* フィードバック投稿フォーム */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
        <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          フィードバックを追加
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">カテゴリ</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {FEEDBACK_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">対象セクション（任意）</label>
              <input
                type="text"
                value={section}
                onChange={e => setSection(e.target.value)}
                placeholder="例: 導入効果"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="フィードバック内容を入力してください..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />

          <button
            onClick={submitFeedback}
            disabled={submitting || !content.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            送信
          </button>
        </div>
      </div>

      {/* フィードバック一覧 */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>まだフィードバックはありません</p>
          </div>
        ) : (
          feedbacks.map(fb => {
            const Icon = AUTHOR_ICONS[fb.authorType] || User
            return (
              <div key={fb.id} className={`bg-white rounded-xl border p-5 ${fb.applied ? 'border-green-200 bg-green-50/30' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    fb.authorType === 'COMPANY' ? 'bg-indigo-100 text-indigo-600' :
                    fb.authorType === 'RESPONDENT' ? 'bg-amber-100 text-amber-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-slate-900">
                      {fb.authorType === 'COMPANY' ? '企業担当者' : fb.authorType === 'RESPONDENT' ? '回答者' : 'AI'}
                      {fb.authorName && ` (${fb.authorName})`}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">
                      {new Date(fb.createdAt).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  {fb.category && (
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                      {FEEDBACK_CATEGORIES.find(c => c.value === fb.category)?.label || fb.category}
                    </span>
                  )}
                  {fb.applied && (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-bold">適用済み</span>
                  )}
                </div>
                {fb.section && (
                  <p className="text-xs text-slate-500 mb-2">対象: {fb.section}</p>
                )}
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{fb.content}</p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
