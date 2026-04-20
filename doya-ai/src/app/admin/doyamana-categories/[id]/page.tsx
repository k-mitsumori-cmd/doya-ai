'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  FolderOpen,
  Image as ImageIcon,
  BarChart3,
  TrendingUp,
  Eye,
  Edit,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CategoryDetail {
  id: string
  name: string
  slug: string
  description: string | null
  order: number
  isActive: boolean
  createdAt: string
}

interface CategoryStats {
  totalImages: number
  activeImages: number
  totalUsage: number
}

interface CategoryImage {
  id: string
  imageUrl: string
  thumbnailUrl: string | null
  promptSummary: string | null
  usageCount: number
  isActive: boolean
  order: number
  createdAt: string
}

export default function DoyamanaCategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [category, setCategory] = useState<CategoryDetail | null>(null)
  const [stats, setStats] = useState<CategoryStats | null>(null)
  const [images, setImages] = useState<CategoryImage[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCategory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/doyamana/categories/${id}`)
      const data = await res.json()
      
      if (data.category) {
        setCategory(data.category)
        setStats(data.stats)
        setImages(data.images || [])
      } else {
        toast.error('カテゴリが見つかりません')
      }
    } catch (error) {
      console.error('カテゴリ取得エラー:', error)
      toast.error('カテゴリの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchCategory()
  }, [fetchCategory])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-white/60">読み込み中...</p>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-white/60">カテゴリが見つかりません</p>
      </div>
    )
  }

  // 使用回数の最大値（グラフ表示用）
  const maxUsage = Math.max(...images.map(img => img.usageCount), 1)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/doyamana-categories">
          <button className="p-2 bg-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FolderOpen className="w-7 h-7 text-emerald-400" />
            カテゴリ: {category.name}
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {category.description || 'カテゴリの詳細と使用状況を確認できます'}
          </p>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-white/60 text-sm">登録画像数</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.totalImages || 0}</p>
          <p className="text-white/40 text-sm mt-1">
            アクティブ: {stats?.activeImages || 0}件
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-violet-400" />
            </div>
            <span className="text-white/60 text-sm">累計使用回数</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.totalUsage || 0}</p>
          <p className="text-white/40 text-sm mt-1">
            平均: {stats?.totalImages ? Math.round((stats.totalUsage || 0) / stats.totalImages) : 0}回/画像
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-white/60 text-sm">状態</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {category.isActive ? 'ON' : 'OFF'}
          </p>
          <p className="text-white/40 text-sm mt-1">
            表示順: {category.order}
          </p>
        </motion.div>
      </div>

      {/* 画像別使用回数一覧 */}
      <div className="bg-white/5 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            画像別 使用回数一覧
          </h2>
        </div>
        
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="p-4 text-left text-white/60 text-sm font-medium">画像</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">プロンプト冒頭</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium w-64">使用回数</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">状態</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {images.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-white/40">
                  このカテゴリには画像がありません
                </td>
              </tr>
            ) : (
              images.map((image) => (
                <tr key={image.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/10">
                      {image.imageUrl ? (
                        <img
                          src={image.thumbnailUrl || image.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-white/80 text-sm max-w-xs truncate">
                      {image.promptSummary || '-'}
                    </p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium w-12">{image.usageCount}回</span>
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(image.usageCount / maxUsage) * 100}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {image.isActive ? (
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
                    <div className="flex gap-2">
                      <button className="p-2 bg-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <Link href={`/admin/doyamana-images/${image.id}/edit`}>
                        <button className="p-2 bg-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 簡易グラフ（使用回数トップ5） */}
      {images.length > 0 && (
        <div className="mt-8 bg-white/5 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-400" />
            使用回数トップ5
          </h2>
          <div className="space-y-4">
            {images.slice(0, 5).map((image, index) => (
              <div key={image.id} className="flex items-center gap-4">
                <span className="text-white/40 text-sm w-6">{index + 1}.</span>
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                  {image.imageUrl ? (
                    <img
                      src={image.thumbnailUrl || image.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="h-6 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(image.usageCount / maxUsage) * 100}%` }}
                      transition={{ duration: 0.8, delay: index * 0.1 }}
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-end pr-3"
                    >
                      <span className="text-white text-xs font-medium">
                        {image.usageCount}回
                      </span>
                    </motion.div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
