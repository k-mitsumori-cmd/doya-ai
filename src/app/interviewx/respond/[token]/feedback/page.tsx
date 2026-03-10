'use client'

// ============================================
// 回答者向けフィードバックページ
// ============================================
// 生成された記事に対するフィードバックを回答者が送信
// 記事プレビュー + フィードバックフォーム（認証不要）

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface DraftData {
  id: string
  version: number
  title?: string
  lead?: string
  content: string
  wordCount?: number
  readingTime?: number
  status: string
  createdAt: string
}

interface ProjectInfo {
  title: string
  companyName?: string
  companyLogo?: string
  brandColor: string
}

const FEEDBACK_CATEGORIES = [
  { value: 'FACT_CORRECTION', label: '事実の訂正' },
  { value: 'TONE', label: 'トーンの調整' },
  { value: 'ADDITION', label: '内容の追加' },
  { value: 'DELETION', label: '内容の削除' },
  { value: 'GENERAL', label: 'その他' },
]

export default function FeedbackPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [draft, setDraft] = useState<DraftData | null>(null)
  const [status, setStatus] = useState<string>('')

  // フィードバックフォーム
  const [category, setCategory] = useState('GENERAL')
  const [content, setContent] = useState('')
  const [section, setSection] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/interviewx/public/${token}/status`)
        const data = await res.json()

        if (!data.success) {
          setError(data.error || 'データの取得に失敗しました')
          return
        }

        setStatus(data.status)
        setProject(data.project)

        if (['REVIEW', 'FEEDBACK'].includes(data.status) && data.draft) {
          setDraft(data.draft)
        } else if (!['REVIEW', 'FEEDBACK'].includes(data.status)) {
          setError('現在、記事の確認ができる状態ではありません。記事が生成されるまでお待ちください。')
        }
      } catch {
        setError('通信エラーが発生しました')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [token])

  const handleSubmit = async () => {
    if (!content.trim()) {
      setSubmitError('フィードバック内容を入力してください')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(`/api/interviewx/public/${token}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          section: section.trim() || undefined,
          category,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setSubmitError(data.error || '送信に失敗しました')
        return
      }

      setSubmitted(true)
      setContent('')
      setSection('')
    } catch {
      setSubmitError('通信エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  const brandColor = project?.brandColor || '#3B82F6'

  // ローディング
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="mt-4 text-gray-500 text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  // エラー
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">&#128221;</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">記事確認</h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)`,
        }}
      >
        <div className="relative max-w-3xl mx-auto px-4 py-8">
          {project?.companyLogo && (
            <img
              src={project.companyLogo}
              alt={project?.companyName || ''}
              className="h-8 object-contain mb-3"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          )}
          {project?.companyName && !project?.companyLogo && (
            <p className="text-white/80 text-sm font-medium mb-2">{project.companyName}</p>
          )}
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            記事のご確認・フィードバック
          </h1>
          <p className="text-white/70 text-sm mt-1">
            生成された記事をご確認いただき、修正のご要望があればお知らせください。
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* 記事プレビュー */}
        {draft && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">記事プレビュー</h2>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {draft.wordCount && <span>{draft.wordCount.toLocaleString()}文字</span>}
                {draft.readingTime && <span>/ 読了 約{draft.readingTime}分</span>}
              </div>
            </div>

            {draft.title && (
              <h3 className="text-xl font-bold text-gray-800 mb-3">{draft.title}</h3>
            )}
            {draft.lead && (
              <p className="text-gray-600 text-sm leading-relaxed mb-4 pb-4 border-b border-gray-100">
                {draft.lead}
              </p>
            )}

            {/* Markdown風に表示（簡易版） */}
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
              {draft.content.split('\n').map((line, i) => {
                // 見出し
                if (line.startsWith('### ')) {
                  return <h4 key={i} className="text-base font-bold text-gray-800 mt-6 mb-2">{line.slice(4)}</h4>
                }
                if (line.startsWith('## ')) {
                  return <h3 key={i} className="text-lg font-bold text-gray-800 mt-8 mb-3">{line.slice(3)}</h3>
                }
                if (line.startsWith('# ')) {
                  return <h2 key={i} className="text-xl font-bold text-gray-800 mt-8 mb-3">{line.slice(2)}</h2>
                }
                // 引用
                if (line.startsWith('> ')) {
                  return (
                    <blockquote
                      key={i}
                      className="border-l-4 pl-4 my-3 italic text-gray-600"
                      style={{ borderColor: brandColor }}
                    >
                      {line.slice(2)}
                    </blockquote>
                  )
                }
                // 空行
                if (!line.trim()) {
                  return <br key={i} />
                }
                // 太字変換
                const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                return (
                  <p
                    key={i}
                    className="mb-2"
                    dangerouslySetInnerHTML={{ __html: formatted }}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* フィードバック送信済み */}
        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6 text-center">
            <div className="text-3xl mb-2">&#10003;</div>
            <p className="text-green-700 font-medium">フィードバックを送信しました</p>
            <p className="text-green-600 text-sm mt-1">ありがとうございます。担当者が確認いたします。</p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-4 text-sm underline"
              style={{ color: brandColor }}
            >
              追加のフィードバックを送信する
            </button>
          </div>
        )}

        {/* フィードバックフォーム */}
        {!submitted && draft && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-800 mb-1">フィードバック</h2>
            <p className="text-sm text-gray-400 mb-6">
              記事の内容について修正のご要望があればお知らせください。
            </p>

            {/* カテゴリ選択 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className="px-4 py-2 rounded-lg text-sm border-2 transition-all"
                    style={{
                      borderColor: category === cat.value ? brandColor : '#E5E7EB',
                      backgroundColor: category === cat.value ? `${brandColor}10` : '#FFFFFF',
                      color: category === cat.value ? brandColor : '#6B7280',
                      fontWeight: category === cat.value ? 600 : 400,
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 該当セクション（任意） */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                該当セクション <span className="text-gray-400 font-normal">(任意)</span>
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                placeholder="例: 導入効果のセクション"
              />
            </div>

            {/* フィードバック内容 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                フィードバック内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition resize-y"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                placeholder="修正してほしい内容や、追加・削除してほしい情報があればお書きください。"
              />
            </div>

            {submitError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{submitError}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !content.trim()}
              className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  送信中...
                </span>
              ) : (
                'フィードバックを送信する'
              )}
            </button>
          </div>
        )}

        {/* フッター */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400">
            Powered by ドヤインタビューAI-X
          </p>
        </div>
      </div>
    </div>
  )
}
