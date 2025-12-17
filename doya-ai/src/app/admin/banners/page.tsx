'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Image,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Copy,
  Palette,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { 
  getBanners, 
  saveBanners, 
  addBanner, 
  updateBanner, 
  deleteBanner, 
  toggleBannerActive,
  Banner 
} from '@/lib/banners'

const positionLabels: Record<Banner['position'], string> = {
  dashboard_top: 'ダッシュボード上部',
  dashboard_side: 'サイドバー',
  template_list: 'テンプレート一覧',
  after_generation: '生成完了後',
}

const gradientPresets = [
  { name: 'パープル', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'ピンク', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'ブルー', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { name: 'グリーン', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { name: 'オレンジ', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'ダーク', value: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { name: 'サンセット', value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
  { name: 'オーシャン', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
]

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [previewBanner, setPreviewBanner] = useState<Banner | null>(null)

  useEffect(() => {
    setBanners(getBanners())
  }, [])

  const handleToggleActive = (id: string) => {
    const updated = toggleBannerActive(id)
    if (updated) {
      setBanners(getBanners())
      toast.success(updated.isActive ? 'バナーを有効化しました' : 'バナーを無効化しました')
    }
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('このバナーを削除しますか？')) return
    
    if (deleteBanner(id)) {
      setBanners(getBanners())
      toast.success('バナーを削除しました')
    }
  }

  const handleSave = (banner: Banner) => {
    if (isCreating) {
      const { id, createdAt, updatedAt, ...data } = banner
      addBanner(data)
      toast.success('バナーを作成しました')
    } else {
      updateBanner(banner.id, banner)
      toast.success('バナーを更新しました')
    }
    
    setBanners(getBanners())
    setEditingBanner(null)
    setIsCreating(false)
  }

  const handleDuplicate = (banner: Banner) => {
    const { id, createdAt, updatedAt, ...data } = banner
    addBanner({ ...data, title: `${data.title} (コピー)` })
    setBanners(getBanners())
    toast.success('バナーを複製しました')
  }

  const createNewBanner = () => {
    const newBanner: Banner = {
      id: '',
      title: '',
      description: '',
      imageUrl: '',
      linkUrl: '',
      linkText: '詳しく見る',
      isActive: false,
      position: 'dashboard_top',
      backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      textColor: '#ffffff',
      priority: banners.length + 1,
      startDate: null,
      endDate: null,
      createdAt: '',
      updatedAt: '',
    }
    setEditingBanner(newBanner)
    setIsCreating(true)
  }

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">バナー管理</h1>
            <p className="text-gray-500 text-sm">ドヤマーケの宣伝バナーを管理</p>
          </div>
          <button
            onClick={createNewBanner}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            新規バナー
          </button>
        </div>

        {/* バナー一覧 */}
        <div className="space-y-4">
          {banners.map((banner, index) => (
            <motion.div
              key={banner.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                banner.isActive ? 'border-green-200' : 'border-gray-200'
              }`}
            >
              <div className="flex">
                {/* プレビュー */}
                <div 
                  className="w-40 flex-shrink-0 flex items-center justify-center p-4"
                  style={{ background: banner.backgroundColor }}
                >
                  <span className="text-2xl" style={{ color: banner.textColor }}>
                    {banner.title.slice(0, 2)}
                  </span>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{banner.title || '（タイトル未設定）'}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          banner.isActive 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {banner.isActive ? '有効' : '無効'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          {positionLabels[banner.position]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-1 mb-2">
                        {banner.description || '（説明未設定）'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>優先度: {banner.priority}</span>
                        <span>リンク: {banner.linkUrl || '未設定'}</span>
                      </div>
                    </div>

                    {/* アクション */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleActive(banner.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          banner.isActive
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                        title={banner.isActive ? '無効化' : '有効化'}
                      >
                        {banner.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => {
                          setEditingBanner(banner)
                          setIsCreating(false)
                        }}
                        className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                        title="編集"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(banner)}
                        className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                        title="複製"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(banner.id)}
                        className="p-2 rounded-lg bg-gray-100 text-red-500 hover:bg-red-100 transition-colors"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {banners.length === 0 && (
            <div className="text-center py-16 bg-gray-50 rounded-xl">
              <Image className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">バナーがありません</p>
              <button
                onClick={createNewBanner}
                className="mt-4 text-primary-600 hover:underline"
              >
                最初のバナーを作成
              </button>
            </div>
          )}
        </div>

        {/* 編集モーダル */}
        {editingBanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  {isCreating ? 'バナーを作成' : 'バナーを編集'}
                </h2>
                <button
                  onClick={() => {
                    setEditingBanner(null)
                    setIsCreating(false)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* プレビュー */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">プレビュー</label>
                  <div
                    className="rounded-xl p-4 flex items-center gap-4"
                    style={{ background: editingBanner.backgroundColor }}
                  >
                    <div className="flex-1">
                      <h4 
                        className="font-bold text-sm mb-1"
                        style={{ color: editingBanner.textColor }}
                      >
                        {editingBanner.title || 'タイトル'}
                      </h4>
                      <p 
                        className="text-xs opacity-80"
                        style={{ color: editingBanner.textColor }}
                      >
                        {editingBanner.description || '説明文'}
                      </p>
                    </div>
                    <span 
                      className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-gray-900"
                    >
                      {editingBanner.linkText || 'ボタン'}
                    </span>
                  </div>
                </div>

                {/* 基本情報 */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                    <input
                      type="text"
                      value={editingBanner.title}
                      onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-500"
                      placeholder="🎯 ドヤマーケでマーケティングを加速"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">表示位置</label>
                    <select
                      value={editingBanner.position}
                      onChange={(e) => setEditingBanner({ ...editingBanner, position: e.target.value as Banner['position'] })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-500"
                    >
                      {Object.entries(positionLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">説明文</label>
                  <textarea
                    value={editingBanner.description}
                    onChange={(e) => setEditingBanner({ ...editingBanner, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-500"
                    placeholder="LP制作・広告運用・SNS運用など、プロのマーケターがあなたのビジネスを全力サポート！"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">リンクURL</label>
                    <input
                      type="url"
                      value={editingBanner.linkUrl}
                      onChange={(e) => setEditingBanner({ ...editingBanner, linkUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-500"
                      placeholder="https://doyamarke.surisuta.jp"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ボタンテキスト</label>
                    <input
                      type="text"
                      value={editingBanner.linkText}
                      onChange={(e) => setEditingBanner({ ...editingBanner, linkText: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-500"
                      placeholder="無料相談する"
                    />
                  </div>
                </div>

                {/* 背景色 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Palette className="w-4 h-4 inline mr-1" />
                    背景グラデーション
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {gradientPresets.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => setEditingBanner({ ...editingBanner, backgroundColor: preset.value })}
                        className={`h-12 rounded-lg border-2 transition-all ${
                          editingBanner.backgroundColor === preset.value
                            ? 'border-primary-500 ring-2 ring-primary-200'
                            : 'border-transparent'
                        }`}
                        style={{ background: preset.value }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">優先度（小さいほど上）</label>
                    <input
                      type="number"
                      value={editingBanner.priority}
                      onChange={(e) => setEditingBanner({ ...editingBanner, priority: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-500"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">テキスト色</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingBanner({ ...editingBanner, textColor: '#ffffff' })}
                        className={`flex-1 py-2 rounded-lg border-2 ${
                          editingBanner.textColor === '#ffffff' ? 'border-primary-500' : 'border-gray-200'
                        } bg-gray-900 text-white font-medium`}
                      >
                        白
                      </button>
                      <button
                        onClick={() => setEditingBanner({ ...editingBanner, textColor: '#333333' })}
                        className={`flex-1 py-2 rounded-lg border-2 ${
                          editingBanner.textColor === '#333333' ? 'border-primary-500' : 'border-gray-200'
                        } bg-white text-gray-900 font-medium`}
                      >
                        黒
                      </button>
                    </div>
                  </div>
                </div>

                {/* 有効/無効 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">バナーを有効化</p>
                    <p className="text-sm text-gray-500">有効にするとユーザーに表示されます</p>
                  </div>
                  <button
                    onClick={() => setEditingBanner({ ...editingBanner, isActive: !editingBanner.isActive })}
                    className={`w-14 h-8 rounded-full transition-colors ${
                      editingBanner.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                      editingBanner.isActive ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              {/* フッター */}
              <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setEditingBanner(null)
                    setIsCreating(false)
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleSave(editingBanner)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Save className="w-4 h-4" />
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

