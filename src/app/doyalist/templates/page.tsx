'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'

interface Template {
  id: string
  title: string
  description: string
  criteria: {
    industries?: string[]
    areas?: string[]
    keywords?: string[]
    employeeMin?: number
    employeeMax?: number
    capitalMin?: string
  }
  createdAt: string
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newIndustries, setNewIndustries] = useState('')
  const [newAreas, setNewAreas] = useState('')
  const [newKeywords, setNewKeywords] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/doyalist/templates')
      if (res.ok) {
        const data = await res.json()
        // API returns array directly (not wrapped in .templates)
        setTemplates(Array.isArray(data) ? data : data.templates || [])
      }
    } catch (err) {
      console.error('テンプレート取得エラー:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!newTitle.trim()) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/doyalist/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          criteria: {
            industries: newIndustries.split(',').map((s) => s.trim()).filter(Boolean),
            areas: newAreas.split(',').map((s) => s.trim()).filter(Boolean),
            keywords: newKeywords.split(',').map((s) => s.trim()).filter(Boolean),
          },
        }),
      })
      if (res.ok) {
        setShowModal(false)
        setNewTitle('')
        setNewDescription('')
        setNewIndustries('')
        setNewAreas('')
        setNewKeywords('')
        fetchTemplates()
      }
    } catch (err) {
      console.error('テンプレート保存エラー:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return
    setDeletingId(id)
    try {
      // DELETE endpoint is at /api/doyalist/templates/[id]
      const res = await fetch(`/api/doyalist/templates/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id))
      }
    } catch (err) {
      console.error('テンプレート削除エラー:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleUseTemplate = (template: Template) => {
    const params = new URLSearchParams()
    if (template.criteria.industries?.length) {
      params.set('industries', template.criteria.industries.join(','))
    }
    if (template.criteria.areas?.length) {
      params.set('areas', template.criteria.areas.join(','))
    }
    if (template.criteria.keywords?.length) {
      params.set('keywords', template.criteria.keywords.join(','))
    }
    router.push(`/doyalist/new?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-blue-50/30">
      {/* ===== Header ===== */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="bg-white px-6 lg:px-8 pt-8 pb-6 border-b border-slate-100"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <motion.div
                className="relative w-16 h-16 shrink-0"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Image
                  src="/characters/present_プレゼン.png"
                  alt="テンプレート"
                  width={64}
                  height={64}
                  className="object-contain rounded-full"
                />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                  テンプレート
                </h1>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  よく使う条件を保存して素早くリストを作成
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-200/50 hover:bg-blue-600 hover:shadow-blue-300/60 active:scale-[0.97] transition-all duration-200"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              新規テンプレート
            </button>
          </motion.div>

          {/* Stat pill */}
          <div className="flex items-center gap-2.5 mt-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.35, ease: 'easeOut' }}
              className="inline-flex items-center gap-2.5 bg-white rounded-full px-4 py-2 shadow-sm border border-slate-100"
            >
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              <span className="material-symbols-outlined text-base text-slate-400">bookmarks</span>
              <span className="text-sm font-semibold text-slate-600">
                <span className="font-bold text-slate-800 ml-0.5">
                  {templates.length}
                  <span className="text-slate-400 font-medium ml-0.5">件</span>
                </span>
              </span>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ===== Main Content ===== */}
      <div className="px-6 lg:px-8 max-w-6xl mx-auto pt-6 pb-24">
        {/* Loading Skeleton */}
        {isLoading && (
          <div>
            <motion.div
              className="flex justify-center mb-4"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Image
                src="/characters/working_作業中.png"
                alt="読み込み中"
                width={80}
                height={80}
                className="object-contain rounded-full"
              />
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 animate-pulse">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 shrink-0" />
                    <div className="flex-1">
                      <div className="h-5 bg-slate-100 rounded-xl w-3/4 mb-2" />
                      <div className="h-3 bg-slate-50 rounded-lg w-1/2" />
                    </div>
                  </div>
                  <div className="flex gap-1.5 mb-4">
                    <div className="h-6 bg-slate-50 rounded-full w-16" />
                    <div className="h-6 bg-slate-50 rounded-full w-20" />
                  </div>
                  <div className="h-10 bg-slate-50 rounded-full w-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && templates.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center py-20 px-4"
          >
            <div className="relative mb-8">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, rotate: [-3, 3, -3] }}
                transition={{
                  rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                  scale: { delay: 0.2, duration: 0.4, ease: 'easeOut' },
                  opacity: { delay: 0.2, duration: 0.4 },
                }}
              >
                <Image
                  src="/characters/thinking_考え中.png"
                  alt="考え中"
                  width={128}
                  height={128}
                  className="object-contain rounded-full"
                />
              </motion.div>
            </div>

            <h3 className="text-xl font-bold text-slate-800 mb-2">
              テンプレートがまだないよ！
            </h3>
            <p className="text-sm text-slate-500 mb-8 text-center max-w-sm leading-relaxed">
              よく使う検索条件をテンプレートとして保存しましょう。次回のリスト作成がもっと素早くなります。
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="group inline-flex items-center gap-2 px-8 py-3.5 bg-blue-500 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-200/50 hover:bg-blue-600 hover:shadow-blue-300/60 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              テンプレートを作成する
              <span className="material-symbols-outlined text-lg transition-transform duration-200 group-hover:translate-x-0.5">
                arrow_forward
              </span>
            </button>
          </motion.div>
        )}

        {/* Template Grid */}
        {!isLoading && templates.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            <AnimatePresence mode="popLayout">
              {templates.map((template, index) => (
                <motion.div
                  key={template.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.04, duration: 0.35 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white rounded-3xl border border-slate-100 p-6 hover:shadow-lg shadow-blue-100/50 transition-shadow duration-300 group relative cursor-pointer"
                >
                  {/* Top: Icon + Delete */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                      <span className="material-symbols-outlined text-blue-500 text-xl">bookmark</span>
                    </div>
                    <button
                      onClick={() => handleDelete(template.id)}
                      disabled={deletingId === template.id}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {deletingId === template.id ? 'progress_activity' : 'delete'}
                      </span>
                    </button>
                  </div>

                  {/* Title + Description */}
                  <h3 className="text-lg font-bold text-slate-800 mb-1 line-clamp-2 leading-snug">
                    {template.title}
                  </h3>
                  {template.description && (
                    <p className="text-xs text-slate-500 font-medium mb-3 line-clamp-2">{template.description}</p>
                  )}

                  {/* Criteria Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {template.criteria.industries?.map((ind) => (
                      <span
                        key={ind}
                        className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs rounded-full font-bold"
                      >
                        {ind}
                      </span>
                    ))}
                    {template.criteria.areas?.map((area) => (
                      <span
                        key={area}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs rounded-full font-bold"
                      >
                        {area}
                      </span>
                    ))}
                    {template.criteria.keywords?.map((kw) => (
                      <span
                        key={kw}
                        className="px-2.5 py-1 bg-amber-50 text-amber-600 text-xs rounded-full font-bold"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>

                  {/* Use Button */}
                  <motion.button
                    onClick={() => handleUseTemplate(template)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 font-bold text-sm rounded-full hover:bg-blue-100 transition-colors duration-200"
                    whileTap={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    <span className="material-symbols-outlined text-base">play_arrow</span>
                    このテンプレートを使う
                  </motion.button>

                  {/* Date */}
                  <div className="flex items-center gap-1 mt-3 justify-center text-xs text-slate-400">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <span className="font-medium">{new Date(template.createdAt).toLocaleDateString('ja-JP')} 作成</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ===== New Template Modal ===== */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 lg:p-8 w-full max-w-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-500 text-lg">bookmark_add</span>
                  </div>
                  新規テンプレート
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all duration-200"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">テンプレート名 *</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="例: IT企業向けリスト"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">説明</label>
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="例: 東京のIT企業50-200名規模"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    業種（カンマ区切り）
                  </label>
                  <input
                    type="text"
                    value={newIndustries}
                    onChange={(e) => setNewIndustries(e.target.value)}
                    placeholder="例: IT, Web制作, マーケティング"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    地域（カンマ区切り）
                  </label>
                  <input
                    type="text"
                    value={newAreas}
                    onChange={(e) => setNewAreas(e.target.value)}
                    placeholder="例: 東京都, 大阪府, 愛知県"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    キーワード（カンマ区切り）
                  </label>
                  <input
                    type="text"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    placeholder="例: DX, AI活用, 業務効率化"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-full transition-colors duration-200"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={isSaving || !newTitle.trim()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-200/50 hover:bg-blue-600 transition-all duration-200 disabled:opacity-50 disabled:shadow-none"
                >
                  {isSaving ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      保存中...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">save</span>
                      保存
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
