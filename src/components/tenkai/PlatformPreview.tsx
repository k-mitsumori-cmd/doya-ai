'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'

// ============================================
// Types
// ============================================
interface PlatformContent {
  title?: string
  body?: string
  caption?: string
  tweets?: string[]
  hashtags?: string[]
  cta?: string
  post_text?: string
  headline?: string
  subject_line?: string
  body_text?: string
  lead_paragraph?: string
  messages?: { type: string; text: string; char_count: number }[]
}

interface PlatformPreviewProps {
  platform: string
  content: PlatformContent
  onEdit?: () => void
  onRefine?: () => void
  onExport?: () => void
  onCopy?: () => void
}

// ============================================
// PlatformPreview コンポーネント
// ============================================
export default function PlatformPreview({
  platform,
  content,
  onEdit,
  onRefine,
  onExport,
  onCopy,
}: PlatformPreviewProps) {
  const [copied, setCopied] = useState(false)

  // コピー処理
  const handleCopy = useCallback(async () => {
    const text =
      content.post_text ||
      content.body ||
      content.caption ||
      content.tweets?.join('\n\n') ||
      content.body_text ||
      (content.headline && content.lead_paragraph
        ? `${content.headline}\n\n${content.lead_paragraph}`
        : '') ||
      content.messages?.map((m) => m.text).join('\n\n') ||
      ''
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onCopy?.()
    } catch {
      // fallback
    }
  }, [content, onCopy])

  // ============================================
  // X (Twitter) プレビュー
  // ============================================
  const renderXPreview = () => (
    <div className="space-y-3">
      {(content.tweets || [content.body || '']).map((tweet, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200 p-4"
        >
          <div className="flex gap-3">
            {/* プロフィール画像 */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-sm font-bold text-slate-900">ユーザー名</span>
                <span className="text-sm text-slate-400">@username</span>
                <span className="text-sm text-slate-300 mx-1">-</span>
                <span className="text-sm text-slate-400">今</span>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {tweet}
              </p>
              {/* エンゲージメント */}
              <div className="flex items-center gap-6 mt-3 text-slate-400">
                <button className="flex items-center gap-1 text-xs hover:text-blue-500 transition-colors">
                  <span className="material-symbols-outlined text-base">chat_bubble_outline</span>
                  <span>0</span>
                </button>
                <button className="flex items-center gap-1 text-xs hover:text-green-500 transition-colors">
                  <span className="material-symbols-outlined text-base">repeat</span>
                  <span>0</span>
                </button>
                <button className="flex items-center gap-1 text-xs hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined text-base">favorite_border</span>
                  <span>0</span>
                </button>
                <button className="flex items-center gap-1 text-xs hover:text-blue-500 transition-colors">
                  <span className="material-symbols-outlined text-base">share</span>
                </button>
              </div>
            </div>
          </div>
          {i < (content.tweets?.length || 1) - 1 && (
            <div className="flex items-center gap-1 mt-2 ml-5">
              <div className="w-0.5 h-4 bg-slate-200 mx-auto" />
            </div>
          )}
        </div>
      ))}
    </div>
  )

  // ============================================
  // Instagram プレビュー
  // ============================================
  const renderInstagramPreview = () => (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 p-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-600" />
        <span className="text-sm font-semibold text-slate-900">username</span>
      </div>
      {/* 画像プレースホルダー */}
      <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <span className="material-symbols-outlined text-6xl text-slate-300">image</span>
      </div>
      {/* アクション */}
      <div className="flex items-center gap-4 p-3">
        <span className="material-symbols-outlined text-2xl text-slate-800">favorite_border</span>
        <span className="material-symbols-outlined text-2xl text-slate-800">chat_bubble_outline</span>
        <span className="material-symbols-outlined text-2xl text-slate-800">send</span>
        <span className="material-symbols-outlined text-2xl text-slate-800 ml-auto">bookmark_border</span>
      </div>
      {/* キャプション */}
      <div className="px-3 pb-4">
        <p className="text-sm text-slate-800 leading-relaxed">
          <span className="font-semibold mr-1">username</span>
          {content.caption || content.body || ''}
        </p>
        {content.hashtags && content.hashtags.length > 0 && (
          <p className="text-sm text-blue-600 mt-2">
            {content.hashtags.map((tag) => `#${tag}`).join(' ')}
          </p>
        )}
      </div>
    </div>
  )

  // ============================================
  // LinkedIn プレビュー
  // ============================================
  const renderLinkedInPreview = () => (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-sky-600" />
        <div>
          <p className="text-sm font-bold text-slate-900">ユーザー名</p>
          <p className="text-xs text-slate-500">役職 | 会社名</p>
          <p className="text-xs text-slate-400">今 - <span className="material-symbols-outlined text-xs align-middle">public</span></p>
        </div>
      </div>
      {/* 本文 */}
      <div className="px-4 pb-4">
        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
          {content.post_text || content.body || ''}
        </p>
        {content.hashtags && content.hashtags.length > 0 && (
          <p className="text-sm text-blue-600 mt-3">
            {content.hashtags.map((tag) => `#${tag}`).join(' ')}
          </p>
        )}
      </div>
      {/* エンゲージメント */}
      <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
        <span className="material-symbols-outlined text-sm text-blue-500">thumb_up</span>
        <span>0</span>
      </div>
      <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-around text-sm text-slate-500">
        <button className="flex items-center gap-1 hover:text-slate-700 transition-colors">
          <span className="material-symbols-outlined text-lg">thumb_up</span>
          いいね！
        </button>
        <button className="flex items-center gap-1 hover:text-slate-700 transition-colors">
          <span className="material-symbols-outlined text-lg">comment</span>
          コメント
        </button>
        <button className="flex items-center gap-1 hover:text-slate-700 transition-colors">
          <span className="material-symbols-outlined text-lg">repeat</span>
          リポスト
        </button>
        <button className="flex items-center gap-1 hover:text-slate-700 transition-colors">
          <span className="material-symbols-outlined text-lg">send</span>
          送信
        </button>
      </div>
    </div>
  )

  // ============================================
  // note/Blog 記事プレビュー
  // ============================================
  const renderArticlePreview = () => (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* サムネイルプレースホルダー */}
      <div className="h-48 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <span className="material-symbols-outlined text-5xl text-blue-300">article</span>
      </div>
      <div className="p-6">
        {content.title && (
          <h2 className="text-xl font-black text-slate-900 mb-4 leading-tight">
            {content.title}
          </h2>
        )}
        <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
          {content.body || ''}
        </div>
      </div>
    </div>
  )

  // ============================================
  // ジェネリックフォールバック
  // ============================================
  const renderGenericPreview = () => (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      {content.title && (
        <h3 className="text-lg font-bold text-slate-900 mb-3">{content.title}</h3>
      )}
      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
        {content.post_text || content.body || content.caption || content.body_text || ''}
      </div>
      {content.hashtags && content.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {content.hashtags.map((tag, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      {content.cta && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-sm font-semibold text-blue-600">{content.cta}</p>
        </div>
      )}
    </div>
  )

  // ============================================
  // プレビュー選択
  // ============================================
  const renderPreview = () => {
    switch (platform) {
      case 'x':
        return renderXPreview()
      case 'instagram':
        return renderInstagramPreview()
      case 'linkedin':
        return renderLinkedInPreview()
      case 'note':
      case 'blog':
        return renderArticlePreview()
      default:
        return renderGenericPreview()
    }
  }

  // ============================================
  // メインレンダー
  // ============================================
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* プレビュー */}
      {renderPreview()}

      {/* アクションツールバー */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
        >
          <span className="material-symbols-outlined text-lg">
            {copied ? 'check' : 'content_copy'}
          </span>
          {copied ? 'コピーしました' : 'コピー'}
        </button>

        {onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            編集
          </button>
        )}

        {onRefine && (
          <button
            onClick={onRefine}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all"
          >
            <span className="material-symbols-outlined text-lg">auto_fix_high</span>
            再生成
          </button>
        )}

        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-700 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            エクスポート
          </button>
        )}
      </div>
    </motion.div>
  )
}
