'use client'

import { motion } from 'framer-motion'
import { ArticleTemplate } from '../types'
import { CheckCircle2, FileText, TrendingUp, Target, BarChart3, Lightbulb } from 'lucide-react'
import { useState } from 'react'

interface ArticleCardProps {
  template: ArticleTemplate
  isSelected: boolean
  onClick: () => void
}

// テンプレートに基づいたグラデーション背景を生成
function getTemplateGradient(template: ArticleTemplate): string {
  // フェーズとカテゴリを組み合わせてユニークなグラデーションを生成
  if (template.phase === '認知' && template.category === '解説型') {
    return 'from-blue-600 via-purple-700 to-indigo-900'
  }
  if (template.phase === '認知' && template.category === '比較型') {
    return 'from-blue-500 via-pink-600 to-purple-800'
  }
  if (template.phase === '認知' && template.category === '一覧型') {
    return 'from-cyan-500 via-blue-600 to-indigo-800'
  }
  if (template.phase === '比較' && template.category === '解説型') {
    return 'from-amber-500 via-purple-600 to-violet-800'
  }
  if (template.phase === '比較' && template.category === '比較型') {
    return 'from-orange-500 via-rose-600 to-pink-800'
  }
  if (template.phase === '比較' && template.category === '一覧型') {
    return 'from-amber-500 via-cyan-600 to-blue-800'
  }
  if (template.phase === 'CV' && template.category === '解説型') {
    return 'from-emerald-500 via-purple-600 to-indigo-800'
  }
  if (template.phase === 'CV' && template.category === '比較型') {
    return 'from-teal-500 via-pink-600 to-rose-800'
  }
  if (template.phase === 'CV' && template.category === '一覧型') {
    return 'from-cyan-500 via-emerald-600 to-teal-800'
  }
  
  return 'from-slate-700 via-gray-800 to-black'
}

// テンプレートに基づいたアイコンを取得
function getTemplateIcon(template: ArticleTemplate) {
  if (template.category === '比較型') return BarChart3
  if (template.category === '一覧型') return TrendingUp
  if (template.phase === 'CV') return Target
  if (template.phase === '認知') return Lightbulb
  return FileText
}

export function ArticleCard({ template, isSelected, onClick }: ArticleCardProps) {
  const [imageError, setImageError] = useState(false)
  const gradient = getTemplateGradient(template)
  const Icon = getTemplateIcon(template)
  const showFallback = !template.imageUrl || imageError

  return (
    <motion.div
      whileHover={{ scale: 1.08, y: -12, zIndex: 10 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`group flex-shrink-0 w-36 h-24 sm:w-48 sm:h-32 md:w-64 md:h-40 lg:w-80 lg:h-48 rounded-md md:rounded-lg overflow-hidden cursor-pointer transition-all duration-300 relative ${
        isSelected
          ? 'ring-3 ring-blue-400 scale-105 shadow-2xl'
          : 'ring-1 ring-gray-800 hover:ring-gray-600'
      }`}
    >
      {/* 背景画像またはグラデーション */}
      <div className="absolute inset-0">
        {template.imageUrl && !imageError ? (
          <img
            src={template.imageUrl}
            alt={template.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient}`}>
            {/* 装飾的なパターン */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl transform translate-x-16 -translate-y-16" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl transform -translate-x-12 translate-y-12" />
            </div>
            {/* アイコン */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-20">
              <Icon className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* オーバーレイ（画像がある場合） */}
      {template.imageUrl && !imageError && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      )}

      {/* コンテンツ */}
      <div className="absolute inset-0 z-10 flex flex-col h-full p-2 sm:p-3 md:p-4 justify-between">
        {/* タイトル */}
        <h3 className="text-xs sm:text-sm md:text-base lg:text-lg font-bold text-white mb-1 sm:mb-2 line-clamp-2 leading-tight drop-shadow-lg">
          {template.title}
        </h3>

        {/* バッジエリア */}
        <div className="flex flex-wrap gap-1 sm:gap-1.5">
          {/* 記事タイプ */}
          <span
            className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-full text-[7px] sm:text-[9px] md:text-[10px] font-bold whitespace-nowrap backdrop-blur-sm ${
              template.phase === '認知'
                ? 'bg-blue-500/90 text-white'
                : template.phase === '比較'
                  ? 'bg-amber-500/90 text-white'
                  : 'bg-emerald-500/90 text-white'
            }`}
          >
            {template.phase}
          </span>

          {/* 記事構造 */}
          <span
            className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-full text-[7px] sm:text-[9px] md:text-[10px] font-bold whitespace-nowrap backdrop-blur-sm ${
              template.category === '解説型'
                ? 'bg-purple-500/90 text-white'
                : template.category === '比較型'
                  ? 'bg-pink-500/90 text-white'
                  : 'bg-cyan-500/90 text-white'
            }`}
          >
            {template.category}
          </span>

          {/* 使いどころ */}
          <span className="px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-full text-[7px] sm:text-[9px] md:text-[10px] font-bold bg-gray-700/90 text-gray-200 whitespace-nowrap backdrop-blur-sm">
            {template.usage}
          </span>
        </div>
      </div>

      {/* ホバー時のグロー効果 */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-transparent" />
      </div>

      {/* 選択中のインジケーター */}
      {isSelected && (
        <div className="absolute -inset-1 ring-4 ring-blue-400 rounded-lg pointer-events-none z-20 shadow-[0_0_30px_rgba(59,130,246,0.6)]">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-white" />
            <p className="text-xs font-bold text-white whitespace-nowrap">選択中</p>
          </div>
        </div>
      )}
    </motion.div>
  )
}
