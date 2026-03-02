'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Plus,
  Edit,
  FolderOpen,
  RefreshCw,
  AlertTriangle,
  Eye,
  Save,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  order: number
  isActive: boolean
  imageCount: number
  totalUsage: number
  createdAt: string
}

export default function DoyamanaCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  
  // モーダル
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  
  // フォーム
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [order, setOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/doyamana/categories?includeStats=true')
      const data = await res.json()
      
      if (data.categories) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('カテゴリ取得エラー:', error)
      toast.error('カテゴリの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const openNewModal = () => {
    setEditingCategory(null)
    setName('')
    setSlug('')
    setDescription('')
    setOrder(categories.length)
    setIsActive(true)
    setModalOpen(true)
  }

  const openEditModal = (category: Category) => {
    setEditingCategory(category)
    setName(category.name)
    setSlug(category.slug)
    setDescription(category.description || '')
    setOrder(category.order)
    setIsActive(category.isActive)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingCategory(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast.error('カテゴリ名を入力してください')
      return
    }
    if (!slug.trim()) {
      toast.error('スラッグを入力してください')
      return
    }

    setSaving(true)
    try {
      const url = editingCategory
        ? `/api/admin/doyamana/categories/${editingCategory.id}`
        : '/api/admin/doyamana/categories'
      
      const res = await fetch(url, {
        method: editingCategory ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          order,
          isActive,
        }),
      })

      if (res.ok) {
        toast.success(editingCategory ? 'カテゴリを更新しました' : 'カテゴリを作成しました')
        closeModal()
        fetchCategories()
      } else {
        const data = await res.json()
        throw new Error(data.error || '保存に失敗しました')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const generateSlug = () => {
    // 日本語をローマ字に変換（簡易版）
    const romanized = name
      .toLowerCase()
      .replace(/[あ-ん]/g, (char) => {
        const hiragana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'
        const romaji = ['a','i','u','e','o','ka','ki','ku','ke','ko','sa','shi','su','se','so','ta','chi','tsu','te','to','na','ni','nu','ne','no','ha','hi','fu','he','ho','ma','mi','mu','me','mo','ya','yu','yo','ra','ri','ru','re','ro','wa','wo','n']
        const index = hiragana.indexOf(char)
        return index >= 0 ? romaji[index] : char
      })
      .replace(/[ア-ン]/g, (char) => {
        const katakana = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'
        const romaji = ['a','i','u','e','o','ka','ki','ku','ke','ko','sa','shi','su','se','so','ta','chi','tsu','te','to','na','ni','nu','ne','no','ha','hi','fu','he','ho','ma','mi','mu','me','mo','ya','yu','yo','ra','ri','ru','re','ro','wa','wo','n']
        const index = katakana.indexOf(char)
        return index >= 0 ? romaji[index] : char
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    
    setSlug(romanized || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FolderOpen className="w-7 h-7 text-emerald-400" />
            ドヤマナAI カテゴリ管理
          </h1>
          <p className="text-white/50 text-sm mt-1">
            カテゴリの追加・編集・無効化を行います
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchCategories()}
            className="p-2.5 bg-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <motion.button
            onClick={openNewModal}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5" />
            新規カテゴリ追加
          </motion.button>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="p-4 text-left text-white/60 text-sm font-medium">カテゴリ名</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">スラッグ</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">表示順</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">状態</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">登録数</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">使用回数</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-white/40">
                  読み込み中...
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-white/40">
                  カテゴリがありません
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <span className="text-white font-medium">{category.name}</span>
                    {category.description && (
                      <p className="text-white/40 text-xs mt-1 truncate max-w-xs">
                        {category.description}
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <code className="px-2 py-1 bg-white/10 rounded text-white/60 text-sm">
                      {category.slug}
                    </code>
                  </td>
                  <td className="p-4">
                    <span className="text-white/80">{category.order}</span>
                  </td>
                  <td className="p-4">
                    {category.isActive ? (
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-xs">
                        ON
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-xs">
                        OFF
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-white/80">{category.imageCount}件</span>
                  </td>
                  <td className="p-4">
                    <span className="text-white/80">{category.totalUsage}回</span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Link href={`/admin/doyamana-categories/${category.id}`}>
                        <button className="p-2 bg-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </Link>
                      <button
                        onClick={() => openEditModal(category)}
                        className="p-2 bg-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 注意事項 */}
      <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-amber-300/80 text-sm">
          <p className="font-medium mb-1">カテゴリ削除について</p>
          <p className="text-amber-300/60">
            画像が登録されているカテゴリは削除できません。先に画像を削除または別カテゴリに移動してください。
            OFFにしたカテゴリは画像登録時に選択できなくなります。
          </p>
        </div>
      </div>

      {/* モーダル */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a24] rounded-2xl p-6 max-w-lg w-full mx-4 border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingCategory ? 'カテゴリ編集' : '新規カテゴリ追加'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-white/60 text-sm mb-2">カテゴリ名 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: SEO系"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-2">スラッグ *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="例: seo"
                    className="flex-1 bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={generateSlug}
                    className="px-3 py-2 bg-white/10 text-white/60 rounded-lg hover:bg-white/20 hover:text-white transition-colors text-sm"
                  >
                    自動生成
                  </button>
                </div>
                <p className="text-white/40 text-xs mt-1">URLに使用される識別子（英数字とハイフンのみ）</p>
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-2">説明</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="カテゴリの説明（任意）"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-white/60 text-sm mb-2">表示順</label>
                  <input
                    type="number"
                    value={order}
                    onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-white/60 text-sm mb-2">状態</label>
                  <div className="flex gap-4 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="modalIsActive"
                        checked={isActive}
                        onChange={() => setIsActive(true)}
                        className="w-4 h-4 text-emerald-500"
                      />
                      <span className="text-white">ON</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="modalIsActive"
                        checked={!isActive}
                        onChange={() => setIsActive(false)}
                        className="w-4 h-4 text-emerald-500"
                      />
                      <span className="text-white">OFF</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                >
                  キャンセル
                </button>
                <motion.button
                  type="submit"
                  disabled={saving}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {saving ? '保存中...' : '保存'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
