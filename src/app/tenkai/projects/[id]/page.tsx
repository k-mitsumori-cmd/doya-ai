'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================
// プラットフォーム定義
// ============================================
const PLATFORMS = [
  { key: 'note', icon: 'edit_note', label: 'note' },
  { key: 'x', icon: 'tag', label: 'X' },
  { key: 'instagram', icon: 'photo_camera', label: 'Instagram' },
  { key: 'linkedin', icon: 'work', label: 'LinkedIn' },
  { key: 'blog', icon: 'article', label: 'Blog' },
  { key: 'line', icon: 'chat', label: 'LINE' },
  { key: 'facebook', icon: 'thumb_up', label: 'Facebook' },
  { key: 'newsletter', icon: 'mail', label: 'メルマガ' },
  { key: 'press_release', icon: 'newspaper', label: 'プレスリリース' },
] as const

type PlatformKey = (typeof PLATFORMS)[number]['key']

// ============================================
// 型定義
// ============================================
interface PlatformOutput {
  id: string
  platform: PlatformKey
  content: Record<string, unknown> // JSON object (platform-specific structure)
  status: 'completed' | 'generating' | 'pending' | 'failed'
  qualityScore?: number
  charCount?: number
  version?: number
  updatedAt?: string
}

interface ProjectDetail {
  id: string
  title: string
  inputType: string
  inputText?: string
  inputUrl?: string
  analysis?: Record<string, unknown>
  status: string
  createdAt: string
  updatedAt: string
  outputs: PlatformOutput[]
}

// ============================================
// ステータスバッジ
// ============================================
function getStatusStyle(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'generating':
      return 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
    case 'ready':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'analyzing':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'draft':
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'completed':
      return '完了'
    case 'generating':
      return '生成中'
    case 'analyzing':
      return '分析中'
    case 'ready':
      return '準備完了'
    case 'draft':
    default:
      return '下書き'
  }
}

// ============================================
// スケルトン
// ============================================
function ContentSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-4 bg-slate-200 rounded w-3/4" />
      <div className="h-4 bg-slate-200 rounded w-full" />
      <div className="h-4 bg-slate-200 rounded w-5/6" />
      <div className="h-4 bg-slate-100 rounded w-2/3" />
      <div className="h-4 bg-slate-100 rounded w-full" />
      <div className="h-4 bg-slate-100 rounded w-4/5" />
      <div className="h-4 bg-slate-100 rounded w-1/2" />
    </div>
  )
}

// ============================================
// Project Detail Page
// ============================================
export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<PlatformKey>('note')
  const [showRefineModal, setShowRefineModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const [refineFeedback, setRefineFeedback] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [isRegenerating, setIsRegenerating] = useState(false)

  // ============================================
  // データ取得
  // ============================================
  const fetchProject = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/tenkai/projects/${projectId}`)
      if (!res.ok) throw new Error('プロジェクトの取得に失敗しました')
      const data = await res.json()
      setProject(data.project)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) fetchProject()
  }, [projectId, fetchProject])

  // ============================================
  // 生成中・分析中のポーリング
  // ============================================
  useEffect(() => {
    if (!project) return
    const isInProgress = project.status === 'generating' || project.status === 'analyzing'
    if (!isInProgress) return

    const interval = setInterval(() => {
      fetchProject()
    }, 3000)

    return () => clearInterval(interval)
  }, [project?.status, fetchProject])

  // ============================================
  // 現在のタブの出力取得
  // ============================================
  const currentOutput = project?.outputs?.find((o) => o.platform === activeTab)

  // ============================================
  // アクション
  // ============================================
  // コンテンツをテキスト表示用に変換
  const getContentText = (output: PlatformOutput | undefined): string => {
    if (!output?.content) return ''
    const c = output.content as Record<string, unknown>

    switch (output.platform) {
      case 'note':
        return `${c.title || ''}\n\n${c.body || ''}\n\nタグ: ${(c.tags as string[] || []).join(', ')}`
      case 'blog':
        return `${(c.seo as Record<string, unknown>)?.title || ''}\n\n${c.body_markdown || c.body_html || ''}`
      case 'x':
        return ((c.tweets as Record<string, unknown>[]) || []).map((t: Record<string, unknown>, i: number) => `${i + 1}/${((c.tweets as Record<string, unknown>[]) || []).length} ${t.text}`).join('\n\n')
      case 'instagram':
        return `${c.caption || ''}\n\n${(c.hashtags as string[] || []).join(' ')}`
      case 'line':
        return ((c.messages as Record<string, unknown>[]) || []).map((m: Record<string, unknown>) => m.text).join('\n\n')
      case 'facebook':
        return String(c.post_text || '')
      case 'linkedin':
        return String(c.post_text || '')
      case 'newsletter':
        return `件名: ${c.subject_line || ''}\n\n${c.body_text || c.body_html || ''}`
      case 'press_release':
        return `${c.headline || ''}\n\n${c.lead_paragraph || ''}\n\n${c.body || ''}`
      default:
        return typeof c === 'string' ? c : JSON.stringify(c, null, 2)
    }
  }

  const handleCopy = async () => {
    const text = getContentText(currentOutput)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      // clipboard API fallback (older browsers, iframe restrictions)
      try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } catch {
        alert('コピーに失敗しました。手動でテキストを選択してコピーしてください。')
      }
    }
  }

  const handleRegenerate = async (feedback?: string) => {
    if (!projectId) return
    setIsRegenerating(true)
    try {
      if (feedback && currentOutput?.id) {
        // フィードバック付き再生成
        const res = await fetch('/api/tenkai/generate/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outputId: currentOutput.id,
            feedback,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          alert(data.error || '再生成に失敗しました')
        }
      } else {
        // 新規生成
        const res = await fetch(`/api/tenkai/generate/${activeTab}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        })
        if (!res.ok) {
          const data = await res.json()
          alert(data.error || '生成に失敗しました')
        }
      }
      await fetchProject()
    } catch {
      alert('生成中にエラーが発生しました')
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleEditorSave = async () => {
    if (!currentOutput?.id || !editorContent) return
    setAutoSaveStatus('saving')
    try {
      // テキストエディタの内容をプラットフォーム別のJSON構造に再構築
      const updatedContent = rebuildContentJson(currentOutput.platform, currentOutput.content, editorContent)
      const res = await fetch(`/api/tenkai/outputs/${currentOutput.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: updatedContent, isEdited: true }),
      })
      if (res.ok) {
        setAutoSaveStatus('saved')
        await fetchProject()
      } else {
        setAutoSaveStatus('idle')
        alert('保存に失敗しました')
      }
    } catch {
      setAutoSaveStatus('idle')
      alert('保存中にエラーが発生しました')
    }
    setShowEditor(false)
  }

  // テキスト編集内容をプラットフォーム別JSONに再構築
  const rebuildContentJson = (
    platform: PlatformKey,
    originalContent: Record<string, unknown>,
    editedText: string
  ): Record<string, unknown> => {
    const c = { ...originalContent }
    switch (platform) {
      case 'note':
        c.body = editedText.replace(/^.*?\n\n/, '').replace(/\n\nタグ:.*$/, '')
        return c
      case 'blog':
        c.body_markdown = editedText.replace(/^.*?\n\n/, '')
        return c
      case 'facebook':
        c.post_text = editedText
        return c
      case 'linkedin':
        c.post_text = editedText.split('\n\n').slice(0, -1).join('\n\n') || editedText
        return c
      case 'instagram':
        c.caption = editedText.split('\n\n')[0] || editedText
        return c
      default:
        // 他のプラットフォームはテキストとして主要フィールドを更新
        return c
    }
  }

  const handleExport = async (format: string) => {
    if (!currentOutput?.id) return
    if (format === 'clipboard') {
      handleCopy()
      setShowExportModal(false)
      return
    }
    try {
      const res = await fetch(`/api/tenkai/outputs/${currentOutput.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: format === 'txt' ? 'text' : format }),
      })
      if (!res.ok) {
        alert('エクスポートに失敗しました')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `export.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('エクスポート中にエラーが発生しました')
    }
    setShowExportModal(false)
  }

  // ============================================
  // Render: Loading
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-4 bg-slate-200 rounded w-48" />
            <div className="h-8 bg-slate-200 rounded w-64" />
            <div className="flex gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-full w-24" />
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <ContentSkeleton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // Render: Error
  // ============================================
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-red-400">error</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">エラーが発生しました</h3>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <button
            onClick={fetchProject}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors mx-auto"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            再試行
          </button>
        </motion.div>
      </div>
    )
  }

  // ============================================
  // Render: Main
  // ============================================
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen pb-20"
    >
      {/* ======== Breadcrumb + Header ======== */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            <Link href="/tenkai/projects" className="hover:text-blue-600 transition-colors">
              プロジェクト
            </Link>
            <span className="material-symbols-outlined text-base">chevron_right</span>
            <span className="text-slate-900 font-medium truncate">
              {project?.title || 'プロジェクト詳細'}
            </span>
          </div>

          {/* Header row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-xl font-bold text-slate-900 truncate">
                {project?.title || '無題のプロジェクト'}
              </h1>
              {project?.status && (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0 ${getStatusStyle(
                    project.status
                  )}`}
                >
                  {getStatusLabel(project.status)}
                </span>
              )}
            </div>

            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:from-blue-600 hover:to-indigo-700 transition-all flex-shrink-0"
            >
              <span className="material-symbols-outlined text-lg">publish</span>
              Publish Now
            </button>
          </div>
        </div>

        {/* ======== Platform Tab Bar ======== */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {PLATFORMS.map((pf) => {
              const isActive = activeTab === pf.key
              const output = project?.outputs?.find((o) => o.platform === pf.key)
              const hasContent = output?.status === 'completed'
              const isGenerating = output?.status === 'generating'

              return (
                <button
                  key={pf.key}
                  onClick={() => setActiveTab(pf.key)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                      : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-base ${
                      isGenerating && !isActive ? 'animate-pulse' : ''
                    }`}
                  >
                    {pf.icon}
                  </span>
                  {pf.label}
                  {hasContent && !isActive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  )}
                  {isGenerating && !isActive && (
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ======== Main Content Area ======== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6">
          {/* Content Preview Area */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Platform header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-blue-500 text-xl">
                        {PLATFORMS.find((p) => p.key === activeTab)?.icon}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        {PLATFORMS.find((p) => p.key === activeTab)?.label}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {currentOutput?.charCount
                          ? `${currentOutput.charCount} 文字`
                          : 'コンテンツ未生成'}
                      </p>
                    </div>
                  </div>

                  {currentOutput?.updatedAt && (
                    <p className="text-xs text-slate-400">
                      最終更新:{' '}
                      {new Date(currentOutput.updatedAt).toLocaleString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  {currentOutput?.status === 'generating' && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-2xl text-blue-500 animate-spin">
                          progress_activity
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mb-1">コンテンツを生成中...</p>
                      <p className="text-xs text-slate-400">
                        しばらくお待ちください。自動的に更新されます。
                      </p>
                    </div>
                  )}

                  {currentOutput?.status === 'completed' && currentOutput.content && (
                    <div className="prose prose-sm prose-slate max-w-none">
                      <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                        {getContentText(currentOutput)}
                      </div>
                    </div>
                  )}

                  {currentOutput?.status === 'failed' && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-2xl text-red-400">
                          error
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mb-1">生成に失敗しました</p>
                      <p className="text-xs text-slate-400 mb-4">
                        もう一度お試しください
                      </p>
                      <button
                        onClick={() => handleRegenerate()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">refresh</span>
                        再生成
                      </button>
                    </div>
                  )}

                  {(!currentOutput || currentOutput.status === 'pending') && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-2xl text-slate-300">
                          draft
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mb-1">
                        コンテンツ未生成
                      </p>
                      <p className="text-xs text-slate-400 mb-4">
                        このプラットフォーム向けのコンテンツはまだ生成されていません
                      </p>
                      <button
                        onClick={() => handleRegenerate()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all"
                      >
                        <span className="material-symbols-outlined text-base">auto_awesome</span>
                        生成する
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ======== Floating Action Toolbar (Right Side) ======== */}
          <div className="hidden lg:flex flex-col gap-2 sticky top-48 h-fit">
            {/* Copy */}
            <div className="group relative">
              <button
                onClick={handleCopy}
                disabled={!currentOutput?.content}
                className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined text-xl">
                  {copySuccess ? 'check' : 'content_copy'}
                </span>
              </button>
              <span className="absolute right-14 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {copySuccess ? 'コピーしました' : 'コピー'}
              </span>
            </div>

            {/* Edit */}
            <div className="group relative">
              <button
                onClick={() => {
                  setEditorContent(getContentText(currentOutput))
                  setShowEditor(true)
                }}
                disabled={!currentOutput?.content}
                className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined text-xl">edit</span>
              </button>
              <span className="absolute right-14 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                編集
              </span>
            </div>

            {/* Regenerate */}
            <div className="group relative">
              <button
                onClick={() => setShowRefineModal(true)}
                className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all"
              >
                <span className="material-symbols-outlined text-xl">auto_awesome</span>
              </button>
              <span className="absolute right-14 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                再生成
              </span>
            </div>

            {/* Export */}
            <div className="group relative">
              <button
                onClick={() => setShowExportModal(true)}
                disabled={!currentOutput?.content}
                className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined text-xl">download</span>
              </button>
              <span className="absolute right-14 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                エクスポート
              </span>
            </div>

            {/* All Outputs */}
            <div className="group relative mt-2 pt-2 border-t border-slate-100">
              <Link
                href={`/tenkai/projects/${projectId}/outputs`}
                className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all"
              >
                <span className="material-symbols-outlined text-xl">grid_view</span>
              </Link>
              <span className="absolute right-14 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                全出力を表示
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ======== Footer Bar ======== */}
      <div className="fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl bg-white/80 border-t border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            {/* Quality Score */}
            <div className="flex items-center gap-6">
              {currentOutput?.qualityScore !== undefined && currentOutput.qualityScore !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    品質スコア
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      Math.round(currentOutput.qualityScore * 100) >= 80
                        ? 'text-emerald-600'
                        : Math.round(currentOutput.qualityScore * 100) >= 60
                        ? 'text-blue-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {Math.round(currentOutput.qualityScore * 100)}/100
                  </span>
                </div>
              )}

              {currentOutput?.charCount !== undefined && currentOutput.charCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    文字数
                  </span>
                  <span className="text-sm font-bold text-slate-700">
                    {currentOutput.charCount.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Auto-save indicator */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  autoSaveStatus === 'saving'
                    ? 'bg-amber-400 animate-pulse'
                    : autoSaveStatus === 'saved'
                    ? 'bg-emerald-400'
                    : 'bg-slate-300'
                }`}
              />
              {autoSaveStatus === 'saving'
                ? '保存中...'
                : autoSaveStatus === 'saved'
                ? '自動保存済み'
                : ''}
            </div>

            {/* Mobile actions */}
            <div className="flex items-center gap-2 lg:hidden">
              <button
                onClick={handleCopy}
                disabled={!currentOutput?.content}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">content_copy</span>
              </button>
              <button
                onClick={() => {
                  setEditorContent(getContentText(currentOutput))
                  setShowEditor(true)
                }}
                disabled={!currentOutput?.content}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">edit</span>
              </button>
              <button
                onClick={() => setShowRefineModal(true)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">auto_awesome</span>
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                disabled={!currentOutput?.content}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">download</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======== Refine Modal ======== */}
      <AnimatePresence>
        {showRefineModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowRefineModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">コンテンツを改善</h3>
                  <button
                    onClick={() => setShowRefineModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      改善の方向性
                    </label>
                    <textarea
                      value={refineFeedback}
                      onChange={(e) => setRefineFeedback(e.target.value)}
                      placeholder="例: もう少しカジュアルなトーンにしてください。冒頭のフックを強くしてください。"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none resize-none h-28"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => setRefineFeedback((prev) => prev + (prev ? '\n' : '') + 'もう少しカジュアルなトーンにしてください')} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-600 font-medium hover:bg-slate-200 transition-colors">
                      トーンを変更
                    </button>
                    <button onClick={() => setRefineFeedback((prev) => prev + (prev ? '\n' : '') + '全体的にもっと短くコンパクトにしてください')} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-600 font-medium hover:bg-slate-200 transition-colors">
                      短くする
                    </button>
                    <button onClick={() => setRefineFeedback((prev) => prev + (prev ? '\n' : '') + 'もっと詳しく、具体例を追加して長くしてください')} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-600 font-medium hover:bg-slate-200 transition-colors">
                      長くする
                    </button>
                    <button onClick={() => setRefineFeedback((prev) => prev + (prev ? '\n' : '') + '末尾に明確なCTA（行動喚起）を追加してください')} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-600 font-medium hover:bg-slate-200 transition-colors">
                      CTA追加
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowRefineModal(false)
                      setRefineFeedback('')
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    disabled={!refineFeedback.trim() || isRegenerating}
                    onClick={() => {
                      handleRegenerate(refineFeedback.trim())
                      setShowRefineModal(false)
                      setRefineFeedback('')
                    }}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 disabled:opacity-50 transition-all"
                  >
                    {isRegenerating ? '再生成中...' : '再生成する'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ======== Export Modal ======== */}
      <AnimatePresence>
        {showExportModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowExportModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">エクスポート</h3>
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    { icon: 'description', label: 'テキスト (.txt)', format: 'txt' },
                    { icon: 'code', label: 'Markdown (.md)', format: 'markdown' },
                    { icon: 'data_object', label: 'JSON (.json)', format: 'json' },
                    { icon: 'content_copy', label: 'クリップボードにコピー', format: 'clipboard' },
                  ].map((option) => (
                    <button
                      key={option.format}
                      onClick={() => handleExport(option.format)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 text-left transition-all"
                    >
                      <span className="material-symbols-outlined text-xl text-slate-500">
                        {option.icon}
                      </span>
                      <span className="text-sm font-medium text-slate-700">{option.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="w-full py-2.5 text-center text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ======== Content Editor Modal ======== */}
      <AnimatePresence>
        {showEditor && currentOutput?.content && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowEditor(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="fixed inset-4 sm:inset-8 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">コンテンツ編集</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowEditor(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleEditorSave}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all"
                  >
                    保存
                  </button>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-auto">
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  className="w-full h-full min-h-[400px] px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 leading-relaxed transition-all outline-none resize-none"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
