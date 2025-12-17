'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, Search } from 'lucide-react'
import { useState } from 'react'

// 全テンプレート一覧
const ALL_TEMPLATES = [
  // ビジネスメール
  { id: 'business-email', name: 'ビジネスメール', icon: '📧', category: 'メール', desc: '丁寧なビジネスメールを作成' },
  { id: 'thank-you-email', name: 'お礼メール', icon: '🙏', category: 'メール', desc: '感謝を伝えるメール' },
  { id: 'apology-email', name: 'お詫びメール', icon: '😔', category: 'メール', desc: '謝罪のメールを作成' },
  { id: 'follow-up-email', name: 'フォローアップメール', icon: '📩', category: 'メール', desc: '商談後のフォローメール' },
  
  // ブログ・記事
  { id: 'blog-article', name: 'ブログ記事', icon: '📝', category: 'ブログ', desc: '読みやすい記事を作成' },
  { id: 'how-to-article', name: 'ハウツー記事', icon: '📚', category: 'ブログ', desc: '手順を解説する記事' },
  { id: 'listicle', name: 'リスト記事', icon: '📋', category: 'ブログ', desc: '〇〇選、まとめ記事' },
  { id: 'product-review', name: '商品レビュー', icon: '⭐', category: 'ブログ', desc: '商品のレビュー記事' },
  
  // SNS
  { id: 'instagram-caption', name: 'Instagram投稿', icon: '📱', category: 'SNS', desc: 'Instagram用キャプション' },
  { id: 'twitter-post', name: 'X（Twitter）投稿', icon: '🐦', category: 'SNS', desc: 'X用の投稿文' },
  { id: 'facebook-post', name: 'Facebook投稿', icon: '👥', category: 'SNS', desc: 'Facebook用投稿' },
  { id: 'linkedin-post', name: 'LinkedIn投稿', icon: '💼', category: 'SNS', desc: 'ビジネスSNS向け投稿' },
  
  // マーケティング
  { id: 'catchcopy', name: 'キャッチコピー', icon: '✨', category: 'マーケティング', desc: '魅力的なキャッチコピー' },
  { id: 'ad-copy', name: '広告文', icon: '📢', category: 'マーケティング', desc: '広告用のコピー' },
  { id: 'landing-page', name: 'LP文章', icon: '🌐', category: 'マーケティング', desc: 'LPのセクション文章' },
  { id: 'press-release', name: 'プレスリリース', icon: '📰', category: 'マーケティング', desc: 'プレスリリース文' },
  
  // ビジネス文書
  { id: 'meeting-minutes', name: '議事録', icon: '📋', category: 'ビジネス', desc: '会議の議事録を作成' },
  { id: 'proposal-document', name: '提案書', icon: '📑', category: 'ビジネス', desc: '企画提案書を作成' },
  { id: 'report', name: '報告書', icon: '📊', category: 'ビジネス', desc: '業務報告書を作成' },
  { id: 'business-plan', name: '事業計画書', icon: '📈', category: 'ビジネス', desc: '事業計画のアウトライン' },
]

const CATEGORIES = ['すべて', 'メール', 'ブログ', 'SNS', 'マーケティング', 'ビジネス']

export default function KantanTextListPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('すべて')

  const filteredTemplates = ALL_TEMPLATES.filter(template => {
    const matchesSearch = template.name.includes(searchQuery) || template.desc.includes(searchQuery)
    const matchesCategory = selectedCategory === 'すべて' || template.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/kantan/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </Link>
          <span className="font-bold text-gray-800">全テンプレート（{ALL_TEMPLATES.length}種類）</span>
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 検索 */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="テンプレートを検索..."
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
        </div>

        {/* カテゴリフィルタ */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* テンプレート一覧 */}
        <div className="grid sm:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => (
            <Link key={template.id} href={`/kantan/dashboard/text/${template.id}`}>
              <div className="bg-white rounded-2xl p-5 border-2 border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl">{template.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{template.name}</h3>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                        {template.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{template.desc}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">該当するテンプレートが見つかりません</p>
          </div>
        )}
      </main>
    </div>
  )
}

