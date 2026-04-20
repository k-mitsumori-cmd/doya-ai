'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface Recipe {
  id: string
  name: string
  description: string | null
  category: string | null
  editingGuidelines: string | null
  proposals: any
  questions: any
  isTemplate: boolean
  isPublic: boolean
  usageCount: number
  createdAt: string
}

const CATEGORY_ICONS: Record<string, string> = {
  interview: 'mic',
  panel: 'groups',
  pr: 'campaign',
  news: 'newspaper',
  column: 'edit_note',
  case_study: 'description',
  event: 'event',
  profile: 'person',
  summary: 'summarize',
  custom: 'settings',
}

const CATEGORY_LABELS: Record<string, string> = {
  interview: 'インタビュー',
  panel: '対談・座談会',
  pr: 'プレスリリース',
  news: 'ニュース',
  column: 'コラム',
  case_study: 'ケーススタディ',
  event: 'イベント',
  profile: '人物紹介',
  summary: '要約',
  custom: 'カスタム',
}

const CATEGORY_OPTIONS = [
  { value: 'interview', label: 'インタビュー' },
  { value: 'panel', label: '対談・座談会' },
  { value: 'pr', label: 'プレスリリース' },
  { value: 'news', label: 'ニュース' },
  { value: 'column', label: 'コラム' },
  { value: 'case_study', label: 'ケーススタディ' },
  { value: 'event', label: 'イベント' },
  { value: 'profile', label: '人物紹介' },
  { value: 'summary', label: '要約' },
  { value: 'custom', label: 'カスタム' },
]

const pageVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } }
}

const listVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } }
}

const listItemVariants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } }
}

const slideInVariants = {
  hidden: { opacity: 0, x: 20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

export default function SkillManagementPage() {
  const { data: session, status: sessionStatus } = useSession()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [showOnlyCustom, setShowOnlyCustom] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)

  // 作成/編集モーダル
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState('custom')
  const [formGuidelines, setFormGuidelines] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  // 削除確認
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null)
  const [deleting, setDeleting] = useState(false)

  // AI自動生成
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiSampleText, setAiSampleText] = useState('')
  const [aiName, setAiName] = useState('')
  const [aiCategory, setAiCategory] = useState('custom')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiPreview, setAiPreview] = useState<any>(null)

  const fetchRecipes = async () => {
    try {
      const res = await fetch('/api/interview/recipes')
      const data = await res.json()
      if (data.success) setRecipes(data.recipes || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecipes()
  }, [])

  const categories = [...new Set(recipes.map((r) => r.category).filter(Boolean))]

  const filtered = recipes.filter((r) => {
    if (showOnlyCustom && r.isTemplate) return false
    if (filterCategory && r.category !== filterCategory) return false
    return true
  })

  const openCreateModal = () => {
    setEditingId(null)
    setFormName('')
    setFormDescription('')
    setFormCategory('custom')
    setFormGuidelines('')
    setShowModal(true)
  }

  const openEditModal = (recipe: Recipe) => {
    setEditingId(recipe.id)
    setFormName(recipe.name)
    setFormDescription(recipe.description || '')
    setFormCategory(recipe.category || 'custom')
    setFormGuidelines(recipe.editingGuidelines || '')
    setShowModal(true)
  }

  const handleDuplicate = (recipe: Recipe) => {
    setEditingId(null)
    setFormName(`${recipe.name}（コピー）`)
    setFormDescription(recipe.description || '')
    setFormCategory(recipe.category || 'custom')
    setFormGuidelines(recipe.editingGuidelines || '')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return
    setFormSaving(true)

    try {
      const body = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        category: formCategory,
        editingGuidelines: formGuidelines.trim() || null,
      }

      if (editingId) {
        await fetch(`/api/interview/recipes/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        await fetch('/api/interview/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      setShowModal(false)
      await fetchRecipes()
    } catch {
      alert('保存に失敗しました')
    } finally {
      setFormSaving(false)
    }
  }

  // AI自動生成
  const handleAiGenerate = async () => {
    if (!aiSampleText.trim()) return
    setAiGenerating(true)
    setAiPreview(null)

    try {
      const res = await fetch('/api/interview/recipes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleTexts: [aiSampleText],
          name: aiName || '',
          category: aiCategory,
          autoSave: false,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAiPreview(data.recipe)
      } else {
        alert(data.error || 'スキル生成に失敗しました')
      }
    } catch {
      alert('スキル生成中にエラーが発生しました')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleAiSave = async () => {
    if (!aiPreview) return
    setAiGenerating(true)

    try {
      const res = await fetch('/api/interview/recipes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleTexts: [aiSampleText],
          name: aiName || aiPreview.name || '',
          category: aiCategory || aiPreview.category || 'custom',
          autoSave: true,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowAiModal(false)
        setAiSampleText('')
        setAiName('')
        setAiPreview(null)
        await fetchRecipes()
      } else {
        alert(data.error || '保存に失敗しました')
      }
    } catch {
      alert('保存に失敗しました')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    try {
      const res = await fetch(`/api/interview/recipes/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || '削除に失敗しました')
        return
      }
      setDeleteTarget(null)
      if (selectedRecipe?.id === deleteTarget.id) setSelectedRecipe(null)
      await fetchRecipes()
    } catch {
      alert('削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  // ゲストユーザーはログインを促す
  if (sessionStatus === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-slate-300 border-t-[#7f19e6] rounded-full animate-spin" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
          <div className="w-16 h-16 bg-[#7f19e6]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-[#7f19e6] text-3xl">lock</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">ログインが必要です</h2>
          <p className="text-slate-500 text-sm mb-6">スキル管理を利用するにはログインしてください</p>
          <Link
            href="/api/auth/signin"
            className="inline-flex items-center gap-2 bg-[#7f19e6] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#6b12c9] transition-all shadow-lg shadow-[#7f19e6]/25"
          >
            <span className="material-symbols-outlined text-lg">login</span>
            ログインする
          </Link>
        </div>
      </div>
    )
  }

  return (
    <motion.div className="space-y-8" variants={pageVariants} initial="hidden" animate="show">
      {/* Material Symbols Outlined CSS */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">スキル管理</h1>
          <p className="text-sm text-slate-500 mt-1">記事構成テンプレートの管理・カスタマイズ</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowAiModal(true); setAiPreview(null); setAiSampleText(''); setAiName('') }}
            className="px-4 py-2.5 bg-white text-[#7f19e6] border border-[#7f19e6] rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">auto_awesome</span>
            AIで自動生成
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-[#7f19e6] text-white rounded-lg text-sm font-bold hover:bg-[#6b12c9] transition-colors flex items-center gap-2 shadow-lg shadow-[#7f19e6]/20"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            新規作成
          </button>
        </div>
      </div>

      {/* メインコンテンツ: 2カラムレイアウト */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left sidebar: Category list + Skill list */}
        <aside className="lg:col-span-4 space-y-4">
          {/* Category navigation */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 space-y-1">
            <button
              onClick={() => { setFilterCategory(null); setShowOnlyCustom(false) }}
              className={`w-full flex justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                !filterCategory && !showOnlyCustom ? 'bg-[#7f19e6]/10 text-[#7f19e6] font-bold' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="flex gap-3 items-center">
                <span className="material-symbols-outlined text-lg">view_list</span> すべてのスキル
              </span>
              <span className={`px-2 rounded ${!filterCategory && !showOnlyCustom ? 'bg-[#7f19e6]/20' : 'bg-slate-100'}`}>{recipes.length}</span>
            </button>
            <button
              onClick={() => { setShowOnlyCustom(true); setFilterCategory(null) }}
              className={`w-full flex justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                showOnlyCustom ? 'bg-[#7f19e6]/10 text-[#7f19e6] font-bold' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="flex gap-3 items-center">
                <span className={`material-symbols-outlined text-lg ${showOnlyCustom ? 'text-[#7f19e6]' : 'text-slate-400'}`}>person</span> カスタム
              </span>
              <span className={`px-2 rounded ${showOnlyCustom ? 'bg-[#7f19e6]/20' : 'bg-slate-100'}`}>{recipes.filter(r => !r.isTemplate).length}</span>
            </button>
            <button
              onClick={() => { setShowOnlyCustom(false); setFilterCategory(null) }}
              className={`w-full flex justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                !showOnlyCustom && !filterCategory ? '' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="flex gap-3 items-center">
                <span className="material-symbols-outlined text-lg text-slate-400">verified</span> プリセット
              </span>
              <span className="bg-slate-100 px-2 rounded">{recipes.filter(r => r.isTemplate).length}</span>
            </button>
          </div>

          {/* Skill list in sidebar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">description</span>
                <p className="text-sm text-slate-500">該当するスキルがありません</p>
              </div>
            ) : (
              <motion.div className="divide-y divide-slate-100" variants={listVariants} initial="hidden" animate="show">
                {filtered.map(recipe => (
                  <motion.button
                    variants={listItemVariants}
                    key={recipe.id}
                    onClick={() => setSelectedRecipe(recipe)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                      selectedRecipe?.id === recipe.id ? 'bg-[#7f19e6]/5 border-l-2 border-[#7f19e6]' : ''
                    }`}
                  >
                    <span className="material-symbols-outlined text-[#7f19e6] text-xl shrink-0">
                      {CATEGORY_ICONS[recipe.category!] || 'description'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-snug text-slate-900 truncate">{recipe.name}</p>
                      <p className="text-xs text-slate-500 truncate">{CATEGORY_LABELS[recipe.category!] || recipe.category} · <span className="font-mono">{recipe.usageCount}</span>回</p>
                    </div>
                    {recipe.isTemplate && (
                      <span className="text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded shrink-0">P</span>
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </div>
        </aside>

        {/* Right: Skill detail */}
        <main className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <AnimatePresence mode="wait">
          {selectedRecipe ? (
            <motion.div key={selectedRecipe.id} variants={slideInVariants} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
              <div className="border-b border-slate-100 pb-6 mb-6">
                <div className="flex justify-between items-start">
                  <h2 className="text-2xl font-bold tracking-tight">{selectedRecipe.name}</h2>
                  <div className="flex gap-2">
                    {!selectedRecipe.isTemplate ? (
                      <>
                        <button onClick={() => openEditModal(selectedRecipe)} className="p-2 text-slate-400 hover:text-[#7f19e6] transition-colors">
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button onClick={() => setDeleteTarget(selectedRecipe)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </>
                    ) : (
                      <button onClick={() => handleDuplicate(selectedRecipe)} className="p-2 text-slate-400 hover:text-[#7f19e6] transition-colors">
                        <span className="material-symbols-outlined">content_copy</span>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-slate-500 text-sm mt-1 leading-relaxed">{selectedRecipe.description || 'スキルの説明がありません'}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">folder</span>{CATEGORY_LABELS[selectedRecipe.category!] || selectedRecipe.category}</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">trending_up</span><span className="font-mono">{selectedRecipe.usageCount}</span>回使用</span>
                  {selectedRecipe.isTemplate && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">プリセット</span>}
                </div>
              </div>

              <div className="space-y-6">
                {selectedRecipe.editingGuidelines ? (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase text-[#7f19e6] tracking-wider">AI編集方針</h3>
                    <div className="bg-slate-50 rounded-xl p-4 font-mono text-sm text-slate-600 leading-relaxed border border-slate-100 whitespace-pre-wrap">
                      {selectedRecipe.editingGuidelines}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-6 text-center border border-slate-100">
                    <span className="material-symbols-outlined text-slate-300 text-3xl mb-2 block">description</span>
                    <p className="text-sm text-slate-500">編集方針が設定されていません</p>
                  </div>
                )}
                <div className="flex justify-end">
                  {!selectedRecipe.isTemplate ? (
                    <button onClick={() => openEditModal(selectedRecipe)} className="bg-[#7f19e6] text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-[#6b12c9] transition-colors shadow-lg shadow-[#7f19e6]/20">
                      編集する
                    </button>
                  ) : (
                    <button onClick={() => handleDuplicate(selectedRecipe)} className="bg-white border border-slate-200 text-slate-700 px-6 py-2 rounded-lg font-bold text-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                      複製して編集
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="material-symbols-outlined text-slate-300 text-6xl mb-4">psychology</span>
              <p className="text-slate-500 text-sm">左のリストからスキルを選択してください</p>
            </div>
          )}
          </AnimatePresence>
        </main>
      </div>

      {/* 作成/編集モーダル */}
      <AnimatePresence>
      {showModal && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowModal(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="bg-white rounded-2xl p-6 shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              {editingId ? 'スキルを編集' : 'カスタムスキル作成'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">スキル名 *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例: 社内報向けインタビュー"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">カテゴリ</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6]"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">説明</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="このスキルの概要を記入..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6] resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">編集方針（AIへの指示）</label>
                <textarea
                  value={formGuidelines}
                  onChange={(e) => setFormGuidelines(e.target.value)}
                  placeholder={`例:\n# 出力形式\n- ストーリー形式\n- 3000〜5000文字\n\n# トーン\n- カジュアルだが信頼感のある文体\n\n# 構成\n1. リード文\n2. 経歴紹介\n3. インタビュー本文\n4. まとめ`}
                  rows={8}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-[#7f19e6] resize-y"
                />
                <p className="text-[10px] text-slate-400 mt-1">Markdown形式で記入できます。AIが記事生成時にこの方針に従います。</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 font-semibold"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={!formName.trim() || formSaving}
                className="flex-1 px-4 py-2.5 text-sm text-white bg-[#7f19e6] rounded-lg hover:bg-[#6b12c9] disabled:opacity-50 font-bold shadow-lg shadow-[#7f19e6]/20"
              >
                {formSaving ? '保存中...' : editingId ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* AI自動生成モーダル */}
      <AnimatePresence>
      {showAiModal && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowAiModal(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="bg-white rounded-2xl p-6 shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[#7f19e6]">auto_awesome</span>
              <h2 className="text-lg font-bold text-slate-900">サンプル記事からスキルを自動生成</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">お手本にしたい記事を貼り付けると、AIが構成パターンを分析してスキルを作成します</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">スキル名（任意）</label>
                  <input
                    type="text"
                    value={aiName}
                    onChange={(e) => setAiName(e.target.value)}
                    placeholder="自動命名されます"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">カテゴリ</label>
                  <select
                    value={aiCategory}
                    onChange={(e) => setAiCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6]"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">サンプル記事 *</label>
                <textarea
                  value={aiSampleText}
                  onChange={(e) => setAiSampleText(e.target.value)}
                  placeholder="お手本にしたいインタビュー記事のテキストをここに貼り付けてください...&#10;&#10;AIが構成・文体・トーンを分析してスキルを生成します。"
                  rows={10}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-[#7f19e6] resize-y"
                />
                <p className="text-[10px] text-slate-400 mt-1">{aiSampleText.length.toLocaleString()}文字</p>
              </div>

              {!aiPreview && (
                <button
                  onClick={handleAiGenerate}
                  disabled={!aiSampleText.trim() || aiGenerating}
                  className="w-full py-2.5 bg-[#7f19e6] text-white rounded-lg text-sm font-bold hover:bg-[#6b12c9] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#7f19e6]/20"
                >
                  {aiGenerating ? (
                    <>
                      <span className="material-symbols-outlined animate-spin">progress_activity</span>
                      AI が分析中...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">auto_awesome</span>
                      構成を分析する
                    </>
                  )}
                </button>
              )}

              {aiGenerating && !aiPreview && (
                <div className="text-center py-4">
                  <div className="inline-block w-8 h-8 border-2 border-blue-300 border-t-[#7f19e6] rounded-full animate-spin" />
                </div>
              )}

              {aiPreview && (
                <div className="border border-[#7f19e6]/20 bg-blue-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#7f19e6] text-lg">verified</span>
                    <p className="text-xs font-bold text-[#7f19e6]">AI分析結果プレビュー</p>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">スキル名</span>
                      <span className="text-slate-900 font-medium">{aiPreview.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">カテゴリ</span>
                      <span className="text-slate-900">{CATEGORY_LABELS[aiPreview.category] || aiPreview.category}</span>
                    </div>
                    {aiPreview.detectedFormat && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">検出形式</span>
                        <span className="text-slate-900">{aiPreview.detectedFormat === 'QA' ? 'Q&A形式' : 'ストーリー形式'}</span>
                      </div>
                    )}
                    {aiPreview.estimatedWordCount && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">推定文字数</span>
                        <span className="text-slate-900">約{aiPreview.estimatedWordCount.toLocaleString()}文字</span>
                      </div>
                    )}
                  </div>
                  {aiPreview.description && (
                    <p className="text-xs text-slate-600 bg-white rounded-lg p-2">{aiPreview.description}</p>
                  )}
                  {aiPreview.editingGuidelines && (
                    <div>
                      <p className="text-[10px] font-medium text-slate-600 mb-1">編集方針</p>
                      <pre className="text-[11px] text-slate-500 whitespace-pre-wrap bg-white rounded-lg p-2 max-h-[200px] overflow-y-auto leading-relaxed">{aiPreview.editingGuidelines}</pre>
                    </div>
                  )}
                  {aiPreview.structure && aiPreview.structure.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-slate-600 mb-1">構成パターン</p>
                      <div className="space-y-1">
                        {aiPreview.structure.map((s: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] bg-white rounded-lg px-2 py-1.5">
                            <span className="text-slate-400 w-5">{i + 1}.</span>
                            <span className="text-slate-900 font-medium">{s.section}</span>
                            {s.wordCount && <span className="text-slate-400 ml-auto">~{s.wordCount}字</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setAiPreview(null)}
                      className="flex-1 py-2 bg-white text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 border border-slate-200"
                    >
                      やり直す
                    </button>
                    <button
                      onClick={handleAiSave}
                      disabled={aiGenerating}
                      className="flex-1 py-2 bg-[#7f19e6] text-white rounded-lg text-xs font-bold hover:bg-[#6b12c9] disabled:opacity-50 shadow-lg shadow-[#7f19e6]/20"
                    >
                      {aiGenerating ? '保存中...' : 'このスキルを保存'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!aiPreview && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAiModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 font-semibold"
                >
                  キャンセル
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* 削除確認モーダル */}
      <AnimatePresence>
      {deleteTarget && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDeleteTarget(null)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-red-500">warning</span>
              <p className="text-lg font-bold text-slate-900">スキルを削除しますか？</p>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              「{deleteTarget.name}」を削除します。この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 font-semibold"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 font-bold flex items-center justify-center gap-1"
              >
                {deleting ? (
                  <>削除中...</>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">delete</span>
                    削除する
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  )
}
