'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Upload,
  Save,
  Image as ImageIcon,
  X,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function EditDoyamanaImagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  
  // フォーム
  const [templateId, setTemplateId] = useState('')
  const [industry, setIndustry] = useState('')
  const [category, setCategory] = useState('')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('1200x628')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [isFeatured, setIsFeatured] = useState(false)

  const fetchImage = useCallback(async () => {
    setFetching(true)
    try {
      const res = await fetch(`/api/admin/doyamana/images/${id}`)
      const data = await res.json()
      
      if (data.image) {
        setTemplateId(data.image.templateId)
        setIndustry(data.image.industry)
        setCategory(data.image.category)
        setPrompt(data.image.prompt)
        setSize(data.image.size || '1200x628')
        setImageUrl(data.image.imageUrl || '')
        setIsActive(data.image.isActive)
        setIsFeatured(data.image.isFeatured)
        
        // 画像プレビュー設定
        if (data.image.imageUrl) {
          if (data.image.imageUrl.startsWith('data:')) {
            setImagePreview(data.image.imageUrl)
          } else {
            setImagePreview(`/api/banner/test/image/${data.image.templateId}`)
          }
        }
      } else {
        toast.error('画像が見つかりません')
        router.push('/admin/doyamana-images')
      }
    } catch (error) {
      console.error('画像取得エラー:', error)
      toast.error('画像の取得に失敗しました')
    } finally {
      setFetching(false)
    }
  }, [id, router])

  useEffect(() => {
    fetchImage()
  }, [fetchImage])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
    
    if (!templateId.trim()) {
      toast.error('テンプレートIDを入力してください')
      return
    }
    if (!industry.trim()) {
      toast.error('業種を入力してください')
      return
    }
    if (!category.trim()) {
      toast.error('カテゴリを入力してください')
      return
    }
    if (!prompt.trim()) {
      toast.error('プロンプトを入力してください')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/doyamana/images/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: templateId.trim(),
          industry: industry.trim(),
          category: category.trim(),
          prompt: prompt.trim(),
          size,
          imageUrl: imageUrl || null,
          isActive,
          isFeatured,
        }),
      })

      if (res.ok) {
        toast.success('画像を更新しました')
        router.push('/admin/doyamana-images')
      } else {
        const data = await res.json()
        throw new Error(data.error || '更新に失敗しました')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/admin/doyamana/images/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('画像を削除しました（サービス上からも削除されました）')
        router.push('/admin/doyamana-images')
      } else {
        throw new Error()
      }
    } catch {
      toast.error('削除に失敗しました')
    } finally {
      setDeleteModalOpen(false)
    }
  }

  if (fetching) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-white/60">読み込み中...</p>
      </div>
    )
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ImageIcon className="w-7 h-7 text-emerald-400" />
            画像・プロンプト 編集
          </h1>
          <p className="text-white/50 text-sm mt-1">
            テンプレートID: {templateId}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 画像プレビュー */}
        <div className="bg-white/5 rounded-xl p-6">
          <label className="block text-white font-medium mb-3">画像</label>
          
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

        {/* テンプレートID */}
        <div className="bg-white/5 rounded-xl p-6">
          <label className="block text-white font-medium mb-3">テンプレートID *</label>
          <input
            type="text"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            placeholder="例: fashion-001"
            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* 業種 */}
        <div className="bg-white/5 rounded-xl p-6">
          <label className="block text-white font-medium mb-3">業種 *</label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="例: ファッション・アパレル"
            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* カテゴリ */}
        <div className="bg-white/5 rounded-xl p-6">
          <label className="block text-white font-medium mb-3">カテゴリ *</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="例: ec"
            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* サイズ */}
        <div className="bg-white/5 rounded-xl p-6">
          <label className="block text-white font-medium mb-3">サイズ</label>
          <input
            type="text"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="例: 1200x628"
            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
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
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 rounded"
              />
              <span className="text-white">アクティブ (ON)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 rounded"
              />
              <span className="text-white">注目 (Featured)</span>
            </label>
          </div>
        </div>

        {/* ボタン */}
        <div className="flex gap-4 justify-between">
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            削除
          </button>
          
          <div className="flex gap-4">
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
        </div>
      </form>

      {/* 削除確認モーダル */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a24] rounded-2xl p-6 max-w-md w-full mx-4 border border-white/10"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white">削除の確認</h3>
            </div>
            <p className="text-white/60 mb-6">
              この画像を削除しますか？
              <br />
              <span className="text-red-400 text-sm font-medium">
                ※ 削除するとサービス上からも完全に削除されます
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                削除する
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
