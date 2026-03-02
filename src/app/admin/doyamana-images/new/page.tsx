'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Upload,
  Save,
  Image as ImageIcon,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Category {
  id: string
  name: string
  slug: string
  isActive: boolean
}

export default function NewDoyamanaImagePage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  
  // フォーム
  const [categoryId, setCategoryId] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [order, setOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/doyamana/categories?activeOnly=true')
      const data = await res.json()
      if (data.categories) {
        setCategories(data.categories)
        if (data.categories.length > 0 && !categoryId) {
          setCategoryId(data.categories[0].id)
        }
      }
    } catch (error) {
      console.error('カテゴリ取得エラー:', error)
    }
  }, [categoryId])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // ファイルサイズチェック（5MB以下）
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ファイルサイズは5MB以下にしてください')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setImageUrl(base64)
      setImagePreview(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!categoryId) {
      toast.error('カテゴリを選択してください')
      return
    }
    if (!imageUrl) {
      toast.error('画像をアップロードしてください')
      return
    }
    if (!prompt.trim()) {
      toast.error('プロンプトを入力してください')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/doyamana/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          imageUrl,
          prompt: prompt.trim(),
          order,
          isActive,
        }),
      })

      if (res.ok) {
        toast.success('画像を登録しました')
        router.push('/admin/doyamana-images')
      } else {
        const data = await res.json()
        throw new Error(data.error || '登録に失敗しました')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登録に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/doyamana-images">
          <button className="p-2 bg-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ImageIcon className="w-7 h-7 text-emerald-400" />
            画像・プロンプト 新規登録
          </h1>
          <p className="text-white/50 text-sm mt-1">
            新しい画像とプロンプトを登録します
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 画像アップロード */}
        <div className="bg-white/5 rounded-xl p-6">
          <label className="block text-white font-medium mb-3">画像アップロード *</label>
          
          {imagePreview ? (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="プレビュー"
                className="max-w-full max-h-64 rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  setImageUrl('')
                  setImagePreview(null)
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-emerald-500/50 hover:bg-white/5 transition-colors">
              <Upload className="w-10 h-10 text-white/40 mb-2" />
              <span className="text-white/60 text-sm">クリックして画像を選択</span>
              <span className="text-white/40 text-xs mt-1">PNG, JPG, WEBP (最大5MB)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* カテゴリ */}
        <div className="bg-white/5 rounded-xl p-6">
          <label className="block text-white font-medium mb-3">カテゴリ *</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">選択してください</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          {categories.length === 0 && (
            <p className="text-amber-400 text-sm mt-2">
              ※ 有効なカテゴリがありません。先にカテゴリを作成してください。
            </p>
          )}
        </div>

        {/* 表示順 */}
        <div className="bg-white/5 rounded-xl p-6">
          <label className="block text-white font-medium mb-3">表示順</label>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
            min={0}
            className="w-32 bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-white/40 text-sm mt-2">数値が小さいほど先に表示されます</p>
        </div>

        {/* プロンプト */}
        <div className="bg-white/5 rounded-xl p-6">
          <label className="block text-white font-medium mb-3">生成プロンプト *</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            placeholder="画像生成に使用するプロンプトを入力してください..."
            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        {/* 状態 */}
        <div className="bg-white/5 rounded-xl p-6">
          <label className="block text-white font-medium mb-3">状態</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="isActive"
                checked={isActive}
                onChange={() => setIsActive(true)}
                className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-white">ON</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="isActive"
                checked={!isActive}
                onChange={() => setIsActive(false)}
                className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-white">OFF</span>
            </label>
          </div>
        </div>

        {/* ボタン */}
        <div className="flex gap-4 justify-end">
          <Link href="/admin/doyamana-images">
            <button
              type="button"
              className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
            >
              キャンセル
            </button>
          </Link>
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {loading ? '保存中...' : '保存'}
          </motion.button>
        </div>
      </form>
    </div>
  )
}
