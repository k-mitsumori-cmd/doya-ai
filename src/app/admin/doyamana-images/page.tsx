'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Plus,
  Search,
  Trash2,
  Edit,
  Power,
  PowerOff,
  CheckSquare,
  Square,
  Image as ImageIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Category {
  id: string
  name: string
  slug: string
}

interface BannerImage {
  id: string
  templateId: string
  category: string
  industry: string
  prompt: string
  promptSummary: string
  imageUrl: string | null
  previewUrl: string | null
  isActive: boolean
  isFeatured: boolean
  size: string
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function DoyamanaImagesPage() {
  const [images, setImages] = useState<BannerImage[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // フィルタ
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // モーダル
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | 'bulk' | null>(null)

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/doyamana/categories')
      const data = await res.json()
      if (data.categories) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('カテゴリ取得エラー:', error)
    }
  }, [])

  const fetchImages = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(categoryFilter !== 'all' && { category: categoryFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchQuery && { search: searchQuery }),
      })
      
      const res = await fetch(`/api/admin/doyamana/images?${params}`)
      const data = await res.json()
      
      if (data.images) {
        setImages(data.images)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('画像取得エラー:', error)
      toast.error('画像の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, categoryFilter, statusFilter, searchQuery])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  const handleSelectAll = () => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(images.map(img => img.id)))
    }
  }

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const handleBulkAction = async (action: 'delete' | 'activate' | 'deactivate') => {
    if (selectedIds.size === 0) {
      toast.error('画像を選択してください')
      return
    }

    if (action === 'delete') {
      setDeleteTarget('bulk')
      setDeleteModalOpen(true)
      return
    }

    try {
      const res = await fetch('/api/admin/doyamana/images', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: Array.from(selectedIds) }),
      })
      
      if (res.ok) {
        toast.success(`${selectedIds.size}件の画像を${action === 'activate' ? 'ONに' : 'OFFに'}しました`)
        setSelectedIds(new Set())
        fetchImages()
      } else {
        throw new Error()
      }
    } catch {
      toast.error('操作に失敗しました')
    }
  }

  const handleDelete = async () => {
    try {
      if (deleteTarget === 'bulk') {
        const res = await fetch('/api/admin/doyamana/images', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', ids: Array.from(selectedIds) }),
        })
        if (res.ok) {
          toast.success(`${selectedIds.size}件の画像を削除しました（サービス上からも削除されます）`)
          setSelectedIds(new Set())
        }
      } else if (deleteTarget) {
        const res = await fetch(`/api/admin/doyamana/images/${deleteTarget}`, {
          method: 'DELETE',
        })
        if (res.ok) {
          toast.success('画像を削除しました（サービス上からも削除されます）')
        }
      }
      fetchImages()
    } catch {
      toast.error('削除に失敗しました')
    } finally {
      setDeleteModalOpen(false)
      setDeleteTarget(null)
    }
  }

  const handleSingleDelete = (id: string) => {
    setDeleteTarget(id)
    setDeleteModalOpen(true)
  }

  // 画像URLを取得（Base64の場合はそのまま、APIパスの場合はそのまま）
  const getImageSrc = (image: BannerImage) => {
    if (!image.imageUrl) return null
    if (image.imageUrl.startsWith('data:')) return image.imageUrl
    if (image.imageUrl.startsWith('/api/')) return image.imageUrl
    return `/api/banner/test/image/${image.templateId}`
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ImageIcon className="w-7 h-7 text-emerald-400" />
            ドヤマナAI 画像・プロンプト管理
          </h1>
          <p className="text-white/50 text-sm mt-1">
            画像の追加・編集・削除、プロンプト管理を行います（削除するとサービス上からも削除されます）
          </p>
        </div>
        <Link href="/admin/doyamana-images/new">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5" />
            新規追加
          </motion.button>
        </Link>
      </div>

      {/* フィルタ */}
      <div className="bg-white/5 rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-white/60 text-sm">カテゴリ:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">すべて</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.slug}>{cat.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-white/60 text-sm">状態:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">すべて</option>
            <option value="active">ON</option>
            <option value="inactive">OFF</option>
          </select>
        </div>
        
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="プロンプトで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        
        <button
          onClick={() => fetchImages()}
          className="p-2 bg-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* 一括操作バー */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4 flex items-center justify-between"
        >
          <span className="text-emerald-300 font-medium">
            選択中: {selectedIds.size}件
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('activate')}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors"
            >
              <Power className="w-4 h-4" />
              一括ON
            </button>
            <button
              onClick={() => handleBulkAction('deactivate')}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-lg text-sm hover:bg-amber-500/30 transition-colors"
            >
              <PowerOff className="w-4 h-4" />
              一括OFF
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              一括削除
            </button>
          </div>
        </motion.div>
      )}

      {/* テーブル */}
      <div className="bg-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="p-4 text-left">
                <button onClick={handleSelectAll} className="text-white/60 hover:text-white">
                  {selectedIds.size === images.length && images.length > 0 ? (
                    <CheckSquare className="w-5 h-5" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
              </th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">画像</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">カテゴリ / 業種</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">プロンプト冒頭</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">状態</th>
              <th className="p-4 text-left text-white/60 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-white/40">
                  読み込み中...
                </td>
              </tr>
            ) : images.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-white/40">
                  画像がありません
                </td>
              </tr>
            ) : (
              images.map((image) => (
                <tr key={image.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <button onClick={() => handleSelect(image.id)} className="text-white/60 hover:text-white">
                      {selectedIds.has(image.id) ? (
                        <CheckSquare className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="w-20 h-12 rounded-lg overflow-hidden bg-white/10">
                      {getImageSrc(image) ? (
                        <img
                          src={getImageSrc(image)!}
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
                    <div>
                      <span className="px-2 py-1 bg-white/10 rounded text-white/80 text-sm">
                        {image.category}
                      </span>
                      <p className="text-white/50 text-xs mt-1">{image.industry}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-white/80 text-sm max-w-xs truncate">
                      {image.promptSummary}
                    </p>
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
                      <Link href={`/admin/doyamana-images/${image.id}/edit`}>
                        <button className="p-2 bg-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleSingleDelete(image.id)}
                        className="p-2 bg-red-500/10 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-white/50 text-sm">
            全{pagination.total}件中 {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
              className="p-2 bg-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 text-white/60 text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="p-2 bg-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

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
              {deleteTarget === 'bulk'
                ? `選択した${selectedIds.size}件の画像を削除しますか？`
                : 'この画像を削除しますか？'}
              <br />
              <span className="text-red-400 text-sm font-medium">
                ※ 削除するとサービス上からも完全に削除されます
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeleteModalOpen(false)
                  setDeleteTarget(null)
                }}
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
