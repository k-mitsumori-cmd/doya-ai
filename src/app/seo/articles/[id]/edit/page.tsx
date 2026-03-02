'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Heading2,
  Heading3,
  Quote,
  Code,
  Undo,
  Redo,
  Save,
  Loader2,
  CheckCircle2,
  Wand2,
  Eye,
  Edit3,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'

/**
 * リッチテキストエディタ（Markdown↔HTML変換）
 * TipTap/ProseMirror未導入のため、contenteditable + 独自ツールバーで実装
 * 将来的にTipTapへ移行可能
 */
export default function SeoRichEditPage() {
  const params = useParams<{ id: string }>()
  const articleId = params.id
  const router = useRouter()
  const editorRef = useRef<HTMLDivElement>(null)

  const [article, setArticle] = useState<{
    id: string
    title: string
    finalMarkdown?: string | null
    status: string
  } | null>(null)
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [hasUnsaved, setHasUnsaved] = useState(false)

  // 自動保存タイマー
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const saveRef = useRef<(isAutoSave?: boolean) => Promise<void>>(async () => {})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/seo/articles/${articleId}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `エラー: ${res.status}`)
      }
      const art = json.article
      setArticle(art)
      const md = art?.finalMarkdown || ''
      setContent(md)
      setOriginalContent(md)
    } catch (e: any) {
      setError(e?.message || '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    load()
  }, [load])

  // 変更検知
  useEffect(() => {
    setHasUnsaved(content !== originalContent)
  }, [content, originalContent])

  // 自動保存（30秒ごと） — saveRefを使ってstale closureを回避
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current)
    }
    autoSaveTimerRef.current = setInterval(() => {
      if (hasUnsaved && !saving) {
        saveRef.current(true)
      }
    }, 30000)
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
      }
    }
  }, [hasUnsaved, saving])

  // 離脱警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsaved])

  // 保存
  const save = async (isAutoSave = false) => {
    if (saving) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch(`/api/seo/articles/${articleId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalMarkdown: content, normalize: true }),
      })
      const json = await res.json()
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || '保存に失敗しました')
      }
      setOriginalContent(content)
      setSaved(true)
      if (!isAutoSave) {
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (e: any) {
      setError(e?.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }
  // saveRef を常に最新のsaveに更新（自動保存のstale closure防止）
  saveRef.current = save

  // ツールバーアクション（Markdown記法挿入）
  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('md-editor') as HTMLTextAreaElement
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.substring(start, end)
    const before = content.substring(0, start)
    const after = content.substring(end)
    const newText = before + prefix + selected + suffix + after
    setContent(newText)
    // カーソル位置を調整
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, end + prefix.length)
    }, 0)
  }

  // Markdownをシンプルなプレビューに変換
  const renderPreview = (md: string): string => {
    let html = md
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-gray-900 mt-6 mb-3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 mt-8 mb-4 border-l-4 border-blue-500 pl-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4 border-b border-gray-200 pb-2">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded text-sm font-mono">$1</code>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700">$1</li>')
      .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 py-2 my-4 text-gray-600 italic bg-gray-50 rounded-r-lg">$1</blockquote>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, href) => {
        const safeHref = /^https?:\/\//i.test(href) ? href.replace(/"/g, '&quot;') : '#'
        return `<a href="${safeHref}" class="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener">${text}</a>`
      })
      .replace(/\n\n/g, '</p><p class="text-gray-700 leading-relaxed my-4">')
      .replace(/\n/g, '<br/>')
    return `<p class="text-gray-700 leading-relaxed my-4">${html}</p>`
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-400 font-bold text-sm">読み込み中...</p>
        </div>
      </main>
    )
  }

  if (!article) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 shadow-xl p-8 text-center">
          <p className="text-red-600 font-bold mb-4">{error || '記事が見つかりません'}</p>
          <Link href="/seo">
            <button className="px-6 py-3 rounded-xl bg-gray-900 text-white font-bold">
              一覧へ戻る
            </button>
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 h-14 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Link href={`/seo/articles/${articleId}`}>
            <button className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="hidden sm:block">
            <p className="text-sm font-black text-gray-900 leading-none truncate max-w-xs">
              {article.title}
            </p>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5">エディタ</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsaved && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
              <AlertTriangle className="w-3 h-3" />
              未保存
            </span>
          )}
          {saved && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
              <CheckCircle2 className="w-3 h-3" />
              保存しました
            </span>
          )}
          <button
            onClick={() => save()}
            disabled={saving || !hasUnsaved}
            className="h-9 px-4 rounded-lg bg-gray-100 text-gray-600 text-xs font-black hover:bg-gray-200 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存
          </button>
          <Link href={`/seo/articles/${articleId}/check`}>
            <button className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
              チェックへ進む
            </button>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <div className="sticky top-14 z-30 bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-1 overflow-x-auto">
        <div className="flex items-center gap-1 pr-3 border-r border-gray-100">
          <button
            onClick={() => insertMarkdown('## ', '\n')}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="見出し2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown('### ', '\n')}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="見出し3"
          >
            <Heading3 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 border-r border-gray-100">
          <button
            onClick={() => insertMarkdown('**', '**')}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="太字"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown('*', '*')}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="斜体"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown('[', '](https://)')}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="リンク"
          >
            <Link2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 border-r border-gray-100">
          <button
            onClick={() => insertMarkdown('- ', '\n')}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="箇条書き"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown('1. ', '\n')}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="番号付きリスト"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown('> ', '\n')}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="引用"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown('`', '`')}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="コード"
          >
            <Code className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 border-r border-gray-100">
          <button
            onClick={() => {/* TODO: AI書き直し */}}
            className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
            title="AIで書き直す"
          >
            <Wand2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 pl-3">
          <button
            onClick={() => setMode('edit')}
            className={`p-2 rounded-lg transition-colors ${
              mode === 'edit' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="編集"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`p-2 rounded-lg transition-colors ${
              mode === 'preview' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="プレビュー"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 md:mx-8 mt-4 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor / Preview */}
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-lg overflow-hidden min-h-[600px]">
          {mode === 'edit' ? (
            <textarea
              id="md-editor"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full min-h-[600px] p-6 sm:p-8 font-mono text-sm text-gray-800 leading-relaxed resize-none focus:outline-none"
              placeholder="Markdownで記事を編集してください..."
            />
          ) : (
            <div
              className="w-full min-h-[600px] p-6 sm:p-8 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderPreview(content) }}
            />
          )}
        </div>
      </div>
    </main>
  )
}

