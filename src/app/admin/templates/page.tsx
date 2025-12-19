'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  EyeOff, 
  Crown,
  Save,
  X
} from 'lucide-react'
import { CATEGORIES, SAMPLE_TEMPLATES } from '@/lib/templates'

interface Template {
  id: string
  name: string
  description: string
  categoryId: string
  isPremium: boolean
  isActive: boolean
  usageCount: number
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    // SAMPLE_TEMPLATESからデモデータを生成
    const demoTemplates: Template[] = SAMPLE_TEMPLATES.map((t, index) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      categoryId: t.categoryId,
      isPremium: t.isPremium,
      isActive: true,
      usageCount: Math.floor(Math.random() * 1000) + 100,
    }))
    setTemplates(demoTemplates)
    setIsLoading(false)
  }, [])

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || template.categoryId === categoryFilter
    return matchesSearch && matchesCategory
  })

  const handleToggleActive = (templateId: string) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId ? { ...t, isActive: !t.isActive } : t
      )
    )
  }

  const handleTogglePremium = (templateId: string) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId ? { ...t, isPremium: !t.isPremium } : t
      )
    )
  }

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setIsModalOpen(true)
  }

  const handleSave = () => {
    if (editingTemplate) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id ? editingTemplate : t
        )
      )
      setIsModalOpen(false)
      setEditingTemplate(null)
    }
  }

  const getCategoryName = (categoryId: string) => {
    return CATEGORIES.find((c) => c.id === categoryId)?.name || categoryId
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900 mb-2">
            テンプレート管理
          </h1>
          <p className="text-gray-600">テンプレートの追加・編集・公開設定を管理します</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          新規テンプレート
        </button>
      </div>

      {/* 検索とフィルター */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="テンプレート名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="all">すべてのカテゴリ</option>
          {CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon} {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">総テンプレート数</p>
          <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">公開中</p>
          <p className="text-2xl font-bold text-green-500">
            {templates.filter((t) => t.isActive).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">プレミアム限定</p>
          <p className="text-2xl font-bold text-amber-500">
            {templates.filter((t) => t.isPremium).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">総利用回数</p>
          <p className="text-2xl font-bold text-primary-500">
            {templates.reduce((sum, t) => sum + t.usageCount, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* テンプレートテーブル */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">テンプレート名</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">カテゴリ</th>
              <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">プレミアム</th>
              <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">公開状態</th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">利用回数</th>
              <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredTemplates.map((template) => (
              <motion.tr
                key={template.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{template.name}</p>
                    <p className="text-sm text-gray-500 truncate max-w-xs">{template.description}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600">{getCategoryName(template.categoryId)}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => handleTogglePremium(template.id)}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      template.isPremium
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <Crown className="w-3 h-3" />
                    {template.isPremium ? 'PRO' : '無料'}
                  </button>
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => handleToggleActive(template.id)}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      template.isActive
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {template.isActive ? (
                      <>
                        <Eye className="w-3 h-3" />
                        公開中
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3" />
                        非公開
                      </>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-medium text-gray-900">{template.usageCount.toLocaleString()}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 編集モーダル */}
      {isModalOpen && editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">テンプレート編集</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">テンプレート名</label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">説明</label>
                <textarea
                  value={editingTemplate.description}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  className="input-field resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
                <select
                  value={editingTemplate.categoryId}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, categoryId: e.target.value })}
                  className="input-field"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTemplate.isPremium}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, isPremium: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">プレミアム限定</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTemplate.isActive}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">公開する</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn-secondary"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                保存する
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}


