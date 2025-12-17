'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, ArrowRight, ArrowLeft, X } from 'lucide-react'
import { CATEGORIES, SAMPLE_TEMPLATES } from '@/lib/templates'

function TextGeneratorContent() {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')

  const [selectedCategory, setSelectedCategory] = useState(categoryParam || 'all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTemplates = useMemo(() => {
    return SAMPLE_TEMPLATES.filter((template) => {
      const matchesCategory = selectedCategory === 'all' || template.categoryId === selectedCategory
      const matchesSearch =
        searchQuery === '' ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  const clearSearch = () => {
    setSearchQuery('')
    setSelectedCategory('all')
  }

  return (
    <div className="min-h-screen bg-white lg:bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 lg:py-10">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-base mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            ホームに戻る
          </Link>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
            テンプレート一覧
          </h1>
          <p className="text-base text-gray-600">
            作りたい文章の種類を選んでください
          </p>
        </div>

        {/* 検索 */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="キーワードで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-12 py-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all text-base"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* カテゴリボタン */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            すべて
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.icon} {category.name}
            </button>
          ))}
        </div>

        {/* 検索結果数 */}
        <div className="mb-4 text-sm text-gray-500">
          {filteredTemplates.length}件のテンプレート
        </div>

        {/* テンプレート一覧 */}
        <div className="space-y-3">
          {filteredTemplates.map((template) => {
            const category = CATEGORIES.find((c) => c.id === template.categoryId)

            return (
              <Link
                key={template.id}
                href={`/dashboard/text/${template.id}`}
              >
                <div className="bg-white lg:bg-gray-50 hover:bg-blue-50 rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-all cursor-pointer active:scale-[0.99]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">{category?.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-800 mb-0.5">
                        {template.name}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">{template.description}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-lg text-gray-600 mb-4">
              該当するテンプレートが見つかりませんでした
            </p>
            <button
              onClick={clearSearch}
              className="text-blue-600 hover:underline text-base"
            >
              検索をクリア
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TextGeneratorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white lg:bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <TextGeneratorContent />
    </Suspense>
  )
}
