'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================
// プラットフォーム定義
// ============================================
const PLATFORMS = [
  { key: 'all', icon: 'apps', label: 'すべて' },
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

type FilterKey = (typeof PLATFORMS)[number]['key']

// ============================================
// 型定義
// ============================================
interface OutputItem {
  id: string
  platform: string
  platformIcon: string
  platformLabel: string
  content: string // テキスト変換済みの表示用コンテンツ
  status: 'completed' | 'generating' | 'pending' | 'failed'
  qualityScore?: number // 0-100 スケール
  wordCount?: number
  version?: number
  createdAt: string
  updatedAt: string
}

interface ProjectInfo {
  id: string
  title: string
}

/**
 * プラットフォーム別のJSON contentをテキストに変換
 */
function contentToText(platform: string, content: Record<string, unknown>): string {
  if (!content || typeof content !== 'object') return ''
  const c = content
  switch (platform) {
    case 'note':
      return `${c.title || ''}\n\n${c.body || ''}\n\nタグ: ${(c.tags as string[] || []).join(', ')}`
    case 'blog':
      return `${(c.seo as Record<string, unknown>)?.title || ''}\n\n${c.body_markdown || c.body_html || ''}`
    case 'x':
      return ((c.tweets as Record<string, unknown>[]) || []).map((t, i: number) => `${i + 1}. ${t.text}`).join('\n\n')
    case 'instagram':
      return `${c.caption || ''}\n\n${(c.hashtags as string[] || []).join(' ')}`
    case 'line':
      return ((c.messages as Record<string, unknown>[]) || []).map((m) => String(m.text || '')).join('\n\n')
    case 'facebook':
      return String(c.post_text || '')
    case 'linkedin':
      return String(c.post_text || '')
    case 'newsletter':
      return `件名: ${c.subject_line || ''}\n\n${c.body_text || c.body_html || ''}`
    case 'press_release':
      return `${c.headline || ''}\n\n${c.lead_paragraph || ''}\n\n${c.body || ''}`
    default:
      return JSON.stringify(c, null, 2)
  }
}

// ============================================
// ステータス
// ============================================
function getStatusStyle(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'generating':
      return 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
    case 'failed':
      return 'bg-red-50 text-red-600 border-red-200'
    case 'pending':
    default:
      return 'bg-slate-50 text-slate-500 border-slate-200'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'completed':
      return '完了'
    case 'generating':
      return '生成中'
    case 'failed':
      return '失敗'
    case 'pending':
    default:
      return '未生成'
  }
}

// ============================================
// スケルトン
// ============================================
function OutputSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-24" />
          <div className="h-3 bg-slate-100 rounded w-full max-w-md" />
        </div>
        <div className="h-6 bg-slate-100 rounded-full w-16" />
        <div className="h-6 bg-slate-100 rounded w-12" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-1">
          <div className="h-4 bg-slate-200 rounded w-24" />
          <div className="h-3 bg-slate-100 rounded w-16" />
        </div>
        <div className="h-6 bg-slate-100 rounded-full w-16" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-5/6" />
        <div className="h-3 bg-slate-100 rounded w-3/4" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 bg-slate-100 rounded-lg flex-1" />
        <div className="h-8 bg-slate-100 rounded-lg w-10" />
        <div className="h-8 bg-slate-100 rounded-lg w-10" />
      </div>
    </div>
  )
}

// ============================================
// Outputs Page
// ============================================
export default function ProjectOutputsPage() {
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [outputs, setOutputs] = useState<OutputItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // ============================================
  // データ取得
  // ============================================
  const fetchOutputs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/tenkai/projects/${projectId}`)
      if (!res.ok) throw new Error('出力データの取得に失敗しました')
      const data = await res.json()
      const proj = data.project
      setProject({ id: proj.id, title: proj.title })

      // APIのJSON contentをテキストに変換し、OutputItem形式にマッピング
      const mapped: OutputItem[] = (proj.outputs || []).map((o: Record<string, unknown>) => {
        const platform = String(o.platform || '')
        const meta = PLATFORMS.find((p) => p.key === platform)
        const rawContent = o.content as Record<string, unknown> | null
        return {
          id: String(o.id),
          platform,
          platformIcon: meta?.icon || 'description',
          platformLabel: meta?.label || platform,
          content: rawContent ? contentToText(platform, rawContent) : '',
          status: (o.status as OutputItem['status']) || 'pending',
          qualityScore: typeof o.qualityScore === 'number' ? Math.round(o.qualityScore * 100) : undefined,
          wordCount: typeof o.charCount === 'number' ? o.charCount : undefined,
          version: typeof o.version === 'number' ? o.version : undefined,
          createdAt: String(o.createdAt || ''),
          updatedAt: String(o.updatedAt || ''),
        }
      })
      setOutputs(mapped)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) fetchOutputs()
  }, [projectId, fetchOutputs])

  // ============================================
  // フィルタリング
  // ============================================
  const filteredOutputs = outputs.filter(
    (o) => activeFilter === 'all' || o.platform === activeFilter
  )

  // ============================================
  // アクション
  // ============================================
  const handleRegenerate = async (outputId: string, _platform: string) => {
    try {
      await fetch('/api/tenkai/generate/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId, feedback: '品質を向上させてください' }),
      })
      fetchOutputs()
    } catch {
      alert('再生成に失敗しました')
    }
  }

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      // fallback
    }
  }

  const handleExportSingle = async (output: OutputItem) => {
    try {
      const res = await fetch(`/api/tenkai/outputs/${output.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'markdown' }),
      })
      if (!res.ok) throw new Error('エクスポートに失敗しました')
      const text = await res.text()
      const blob = new Blob([text], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${output.platform}_v${output.version || 1}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('エクスポートに失敗しました')
    }
  }

  const handleBulkExport = async () => {
    try {
      const targetOutputs = activeFilter === 'all'
        ? outputs.filter((o) => o.status === 'completed')
        : outputs.filter((o) => o.platform === activeFilter && o.status === 'completed')

      for (const output of targetOutputs) {
        await handleExportSingle(output)
      }
    } catch {
      alert('エクスポートに失敗しました')
    }
  }

  // ============================================
  // プラットフォームメタ情報
  // ============================================
  const getPlatformMeta = (key: string) => {
    const pf = PLATFORMS.find((p) => p.key === key)
    return { icon: pf?.icon || 'description', label: pf?.label || key }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen"
    >
      {/* ======== Header ======== */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Back + Title */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/tenkai/projects/${projectId}`}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 transition-colors flex-shrink-0"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                戻る
              </Link>
              <div className="h-5 w-px bg-slate-200" />
              <h1 className="text-lg font-bold text-slate-900 truncate">
                {project?.title || 'プロジェクト'} - 全出力
              </h1>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* View Toggle */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">grid_view</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">view_list</span>
                </button>
              </div>

              {/* Bulk Export */}
              <button
                onClick={handleBulkExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all"
              >
                <span className="material-symbols-outlined text-lg">download</span>
                <span className="hidden sm:inline">一括エクスポート</span>
              </button>
            </div>
          </div>

          {/* Platform Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {PLATFORMS.map((pf) => {
              const isActive = activeFilter === pf.key
              const count =
                pf.key === 'all'
                  ? outputs.length
                  : outputs.filter((o) => o.platform === pf.key).length
              return (
                <button
                  key={pf.key}
                  onClick={() => setActiveFilter(pf.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                      : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{pf.icon}</span>
                  {pf.label}
                  {count > 0 && (
                    <span
                      className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ======== Content ======== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading */}
        {loading && (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-3'
            }
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <OutputSkeleton key={i} viewMode={viewMode} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-red-400">error</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">エラーが発生しました</h3>
            <p className="text-sm text-slate-500 mb-6">{error}</p>
            <button
              onClick={fetchOutputs}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              再試行
            </button>
          </motion.div>
        )}

        {/* Empty */}
        {!loading && !error && filteredOutputs.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-blue-400">
                content_paste
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {activeFilter !== 'all' ? 'この条件の出力がありません' : '出力がありません'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md text-center">
              {activeFilter !== 'all'
                ? '別のプラットフォームを選択するか、コンテンツを生成してください'
                : 'プロジェクト詳細ページからコンテンツを生成してください'}
            </p>
          </motion.div>
        )}

        {/* ======== Grid View ======== */}
        {!loading && !error && filteredOutputs.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredOutputs.map((output, index) => {
                const meta = getPlatformMeta(output.platform)
                const preview = output.content
                  ? output.content.slice(0, 200) + (output.content.length > 200 ? '...' : '')
                  : ''

                return (
                  <motion.div
                    key={output.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200/50 transition-all overflow-hidden"
                  >
                    {/* Header */}
                    <div className="p-5 pb-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center">
                            <span className="material-symbols-outlined text-blue-500 text-xl">
                              {meta.icon}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{meta.label}</h3>
                            {output.wordCount && (
                              <p className="text-[10px] text-slate-400">{output.wordCount} 文字</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {output.qualityScore !== undefined && (
                            <span
                              className={`text-xs font-bold ${
                                output.qualityScore >= 80
                                  ? 'text-emerald-600'
                                  : output.qualityScore >= 60
                                  ? 'text-blue-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {output.qualityScore}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusStyle(
                              output.status
                            )}`}
                          >
                            {getStatusLabel(output.status)}
                          </span>
                        </div>
                      </div>

                      {/* Content Preview */}
                      {preview && (
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-4 mb-3">
                          {preview}
                        </p>
                      )}

                      {output.status === 'pending' && (
                        <div className="flex items-center justify-center py-6 text-slate-300">
                          <span className="material-symbols-outlined text-3xl">draft</span>
                        </div>
                      )}

                      {output.status === 'generating' && (
                        <div className="flex items-center justify-center py-6">
                          <span className="material-symbols-outlined text-2xl text-blue-400 animate-spin">
                            progress_activity
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="px-5 pb-5 flex items-center gap-2">
                      <Link
                        href={`/tenkai/projects/${projectId}?tab=${output.platform}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        表示
                      </Link>

                      {output.status === 'completed' && (
                        <>
                          <button
                            onClick={() => handleCopy(output.content)}
                            className="py-2 px-3 rounded-lg text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors"
                            title="コピー"
                          >
                            <span className="material-symbols-outlined text-sm">content_copy</span>
                          </button>
                          <button
                            onClick={() => handleExportSingle(output)}
                            className="py-2 px-3 rounded-lg text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors"
                            title="エクスポート"
                          >
                            <span className="material-symbols-outlined text-sm">download</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleRegenerate(output.id, output.platform)}
                        className="py-2 px-3 rounded-lg text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors"
                        title="再生成"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* ======== List View ======== */}
        {!loading && !error && filteredOutputs.length > 0 && viewMode === 'list' && (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredOutputs.map((output, index) => {
                const meta = getPlatformMeta(output.platform)
                const preview = output.content
                  ? output.content.slice(0, 200) + (output.content.length > 200 ? '...' : '')
                  : ''

                return (
                  <motion.div
                    key={output.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2, delay: index * 0.02 }}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200/50 transition-all p-4"
                  >
                    <div className="flex items-center gap-4">
                      {/* Platform Icon */}
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-blue-500 text-xl">
                          {meta.icon}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-bold text-slate-900">{meta.label}</h3>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusStyle(
                              output.status
                            )}`}
                          >
                            {getStatusLabel(output.status)}
                          </span>
                          {output.qualityScore !== undefined && (
                            <span
                              className={`text-xs font-bold ${
                                output.qualityScore >= 80
                                  ? 'text-emerald-600'
                                  : output.qualityScore >= 60
                                  ? 'text-blue-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {output.qualityScore}/100
                            </span>
                          )}
                        </div>
                        {preview && (
                          <p className="text-xs text-slate-500 truncate">{preview}</p>
                        )}
                      </div>

                      {/* Word Count */}
                      {output.wordCount && (
                        <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">
                          {output.wordCount} 文字
                        </span>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Link
                          href={`/tenkai/projects/${projectId}?tab=${output.platform}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="表示"
                        >
                          <span className="material-symbols-outlined text-lg">visibility</span>
                        </Link>
                        {output.status === 'completed' && (
                          <>
                            <button
                              onClick={() => handleCopy(output.content)}
                              className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="コピー"
                            >
                              <span className="material-symbols-outlined text-lg">content_copy</span>
                            </button>
                            <button
                              onClick={() => handleExportSingle(output)}
                              className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="エクスポート"
                            >
                              <span className="material-symbols-outlined text-lg">download</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleRegenerate(output.id, output.platform)}
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="再生成"
                        >
                          <span className="material-symbols-outlined text-lg">refresh</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}
