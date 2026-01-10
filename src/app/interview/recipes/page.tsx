'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Plus, Search, Star, Users, Settings } from 'lucide-react'
import Link from 'next/link'

export default function InterviewRecipesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [recipes, setRecipes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecipes = async () => {
    try {
      const res = await fetch('/api/interview/recipes')
      const data = await res.json()
      setRecipes(data.recipes || [])
    } catch (error) {
      console.error('Failed to fetch recipes:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecipes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">レシピ一覧</h1>
          <p className="text-slate-600">保存した企画案・質問リストを管理</p>
        </div>
        <button className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all inline-flex items-center gap-2">
          <Plus className="w-5 h-5" />
          新規レシピ作成
        </button>
      </div>

      {/* 検索バー */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="レシピ名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
          />
        </div>
      </div>

      {/* レシピ一覧 */}
      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">まだレシピがありません</p>
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all">
            <Plus className="w-5 h-5" />
            新規レシピを作成
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes
            .filter((recipe) => recipe.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((recipe) => (
              <motion.div
                key={recipe.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-900 flex-1">{recipe.name}</h3>
                  {recipe.isTemplate && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-lg">
                      テンプレート
                    </span>
                  )}
                </div>
                {recipe.description && (
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">{recipe.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {recipe.usageCount || 0}回使用
                    </div>
                    {recipe.category && (
                      <span className="px-2 py-1 bg-slate-100 rounded-lg font-bold">{recipe.category}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
        </div>
      )}
    </div>
  )
}

