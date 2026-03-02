'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================
// カテゴリ定義
// ============================================
const CATEGORIES = [
  { key: 'all', label: 'すべて', icon: 'apps' },
  { key: 'note', label: 'note', icon: 'edit_note' },
  { key: 'blog', label: 'Blog', icon: 'article' },
  { key: 'x', label: 'X', icon: 'tag' },
  { key: 'instagram', label: 'Instagram', icon: 'photo_camera' },
  { key: 'line', label: 'LINE', icon: 'chat' },
  { key: 'facebook', label: 'Facebook', icon: 'thumb_up' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'work' },
  { key: 'newsletter', label: 'メルマガ', icon: 'mail' },
  { key: 'press_release', label: 'プレスリリース', icon: 'newspaper' },
] as const

type CategoryKey = (typeof CATEGORIES)[number]['key']

// ============================================
// 型定義
// ============================================
interface Template {
  id: string
  name: string
  description: string
  platform: string
  platformIcon: string
  platformLabel: string
  isSystem: boolean
  createdAt: string
  updatedAt: string
  content?: string
}

// ============================================
// スケルトン
// ============================================
function TemplateSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-1">
          <div className="h-4 bg-slate-200 rounded w-2/3" />
          <div className="h-3 bg-slate-100 rounded w-1/3" />
        </div>
      </div>
      <div className="h-3 bg-slate-100 rounded w-full mb-2" />
      <div className="h-3 bg-slate-100 rounded w-3/4" />
      <div className="flex gap-2 mt-4">
        <div className="h-8 bg-slate-100 rounded-lg flex-1" />
        <div className="h-8 bg-slate-100 rounded-lg w-16" />
      </div>
    </div>
  )
}

// ============================================
// Template Editor Modal
// ============================================
function TemplateEditor({
  template,
  onClose,
  onSave,
}: {
  template: Template | null
  onClose: () => void
  onSave: (data: { name: string; description: string; platform: string; content: string }) => void
}) {
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [platform, setPlatform] = useState(template?.platform || 'note')
  const [content, setContent] = useState(template?.content || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave({
      name: name.trim(),
      description: description.trim(),
      platform,
      content,
    })
    setSaving(false)
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="fixed inset-4 sm:inset-8 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">
            {template ? 'テンプレートを編集' : 'テンプレートを作成'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || saving}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">テンプレート名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: SEOブログ記事"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">プラットフォーム</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 transition-all outline-none bg-white"
                >
                  {CATEGORIES.filter((c) => c.key !== 'all').map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">説明</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="テンプレートの用途を簡潔に..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">テンプレート内容</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={"テンプレートの構成や指示を記述してください...\n\n例:\n# タイトル\n\n## はじめに\n{{intro}}\n\n## 本文\n{{body}}\n\n## まとめ\n{{conclusion}}"}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none resize-none h-64 font-mono"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ============================================
// Templates Page
// ============================================
export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // ============================================
  // データ取得
  // ============================================
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/tenkai/templates')
      if (!res.ok) throw new Error('テンプレートの取得に失敗しました')
      const data = await res.json()
      setTemplates(data.templates || [])
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // ============================================
  // フィルタリング
  // ============================================
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = activeCategory === 'all' || t.platform === activeCategory
    return matchesSearch && matchesCategory
  })

  // ============================================
  // CRUD
  // ============================================
  const handleSave = async (data: { name: string; description: string; platform: string; content: string }) => {
    try {
      const method = editingTemplate ? 'PUT' : 'POST'
      const url = editingTemplate
        ? `/api/tenkai/templates/${editingTemplate.id}`
        : '/api/tenkai/templates'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error('保存に失敗しました')

      setEditorOpen(false)
      setEditingTemplate(null)
      fetchTemplates()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tenkai/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      setDeleteConfirm(null)
      fetchTemplates()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleUseTemplate = (template: Template) => {
    // Navigate to create page with template pre-selected
    window.location.href = `/tenkai/create?template=${template.id}`
  }

  const platformMeta = (key: string) => {
    const cat = CATEGORIES.find((c) => c.key === key)
    return { icon: cat?.icon || 'description', label: cat?.label || key }
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">テンプレートライブラリ</h1>
              <p className="text-sm text-slate-500 mt-1">
                プラットフォーム別のテンプレートを管理・活用
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* 検索バー */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="テンプレートを検索..."
                  className="w-48 sm:w-64 pl-9 pr-4 py-2.5 rounded-xl bg-slate-100/80 border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none"
                />
              </div>
              <button
                onClick={() => {
                  setEditingTemplate(null)
                  setEditorOpen(true)
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:from-blue-600 hover:to-indigo-700 transition-all"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                <span className="hidden sm:inline">新規作成</span>
              </button>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                      : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{cat.icon}</span>
                  {cat.label}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <TemplateSkeleton key={i} />
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
              onClick={fetchTemplates}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              再試行
            </button>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredTemplates.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-blue-400">description</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {search || activeCategory !== 'all' ? 'テンプレートが見つかりません' : 'テンプレートがありません'}
            </h3>
            <p className="text-sm text-slate-500 mb-8 max-w-md text-center">
              {search
                ? `「${search}」に一致するテンプレートが見つかりませんでした`
                : 'テンプレートを作成して、効率的にコンテンツを生成しましょう'}
            </p>
          </motion.div>
        )}

        {/* Template Grid */}
        {!loading && !error && filteredTemplates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredTemplates.map((template, index) => {
                const meta = platformMeta(template.platform)
                return (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200/50 transition-all p-5"
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-blue-500 text-xl">
                          {meta.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {template.name}
                          </h3>
                          {template.isSystem && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded-md flex-shrink-0">
                              システム
                            </span>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 mt-0.5 text-xs text-slate-400">
                          <span className="material-symbols-outlined text-xs">{meta.icon}</span>
                          {meta.label}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                      {template.description}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => handleUseTemplate(template)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow-sm shadow-blue-500/20 hover:shadow-blue-500/40 transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">play_arrow</span>
                        使用する
                      </button>
                      {!template.isSystem && (
                        <>
                          <button
                            onClick={() => {
                              setEditingTemplate(template)
                              setEditorOpen(true)
                            }}
                            className="py-2 px-3 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setDeleteConfirm(template.id)}
                              className="py-2 px-3 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>

                            <AnimatePresence>
                              {deleteConfirm === template.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setDeleteConfirm(null)}
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                                    className="absolute bottom-10 right-0 z-20 w-56 bg-white rounded-xl border border-slate-200 shadow-xl p-4"
                                  >
                                    <p className="text-sm font-semibold text-slate-900 mb-1">
                                      削除しますか？
                                    </p>
                                    <p className="text-xs text-slate-400 mb-3">
                                      この操作は取り消せません
                                    </p>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => setDeleteConfirm(null)}
                                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                      >
                                        キャンセル
                                      </button>
                                      <button
                                        onClick={() => handleDelete(template.id)}
                                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                                      >
                                        削除
                                      </button>
                                    </div>
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ======== Editor Modal ======== */}
      <AnimatePresence>
        {editorOpen && (
          <TemplateEditor
            template={editingTemplate}
            onClose={() => {
              setEditorOpen(false)
              setEditingTemplate(null)
            }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
