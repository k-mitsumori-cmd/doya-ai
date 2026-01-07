'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw,
  Copy,
  Download,
  Check,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Star,
  Sliders,
  ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface GenerationControlsProps {
  content: string
  onRegenerate: (options: RegenerateOptions) => void
  isLoading?: boolean
  onFavorite?: () => void
  isFavorite?: boolean
}

export interface RegenerateOptions {
  tone: 'casual' | 'neutral' | 'formal' | 'professional'
  length: 'shorter' | 'standard' | 'longer'
  style?: string
}

const toneOptions = [
  { value: 'casual', label: 'カジュアル', emoji: '😊' },
  { value: 'neutral', label: '標準', emoji: '📝' },
  { value: 'formal', label: 'フォーマル', emoji: '👔' },
  { value: 'professional', label: 'プロフェッショナル', emoji: '💼' },
]

const lengthOptions = [
  { value: 'shorter', label: '短め', desc: '簡潔に' },
  { value: 'standard', label: '標準', desc: 'バランス良く' },
  { value: 'longer', label: '長め', desc: '詳細に' },
]

export function GenerationControls({
  content,
  onRegenerate,
  isLoading = false,
  onFavorite,
  isFavorite = false,
}: GenerationControlsProps) {
  const [copied, setCopied] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [tone, setTone] = useState<RegenerateOptions['tone']>('neutral')
  const [length, setLength] = useState<RegenerateOptions['length']>('standard')
  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      toast.success('コピーしました！')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('コピーに失敗しました')
    }
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `doya-ai-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('ダウンロードしました！')
  }

  const handleRegenerate = () => {
    onRegenerate({ tone, length })
  }

  const handleFeedback = (type: 'good' | 'bad') => {
    setFeedback(type)
    toast.success(type === 'good' ? 'フィードバックありがとうございます！' : '改善に活かします')
  }

  return (
    <div className="space-y-4">
      {/* メインアクションボタン */}
      <div className="flex flex-wrap items-center gap-2">
        {/* コピー */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'コピー済み' : 'コピー'}
        </button>

        {/* 再生成 */}
        <button
          onClick={handleRegenerate}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          再生成
        </button>

        {/* ダウンロード */}
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          保存
        </button>

        {/* お気に入り */}
        {onFavorite && (
          <button
            onClick={onFavorite}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              isFavorite
                ? 'bg-amber-100 text-amber-600'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            {isFavorite ? 'お気に入り' : '保存'}
          </button>
        )}

        {/* オプション展開 */}
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors ml-auto"
        >
          <Sliders className="w-4 h-4" />
          調整
          <ChevronDown className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* オプションパネル */}
      {showOptions && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-gray-50 rounded-xl p-4 space-y-4"
        >
          {/* トーン選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              トーン（文体）
            </label>
            <div className="flex flex-wrap gap-2">
              {toneOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTone(option.value as RegenerateOptions['tone'])}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tone === option.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
                  }`}
                >
                  <span>{option.emoji}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 長さ選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              文章の長さ
            </label>
            <div className="flex gap-2">
              {lengthOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLength(option.value as RegenerateOptions['length'])}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    length === option.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
                  }`}
                >
                  <div>{option.label}</div>
                  <div className="text-xs opacity-70">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 再生成ボタン */}
          <button
            onClick={handleRegenerate}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-pulse' : ''}`} />
            {isLoading ? '生成中...' : 'この設定で再生成'}
          </button>
        </motion.div>
      )}

      {/* フィードバック */}
      <div className="flex items-center justify-center gap-4 pt-2 border-t border-gray-100">
        <span className="text-sm text-gray-500">この結果は役に立ちましたか？</span>
        <div className="flex gap-2">
          <button
            onClick={() => handleFeedback('good')}
            className={`p-2 rounded-lg transition-colors ${
              feedback === 'good'
                ? 'bg-green-100 text-green-600'
                : 'hover:bg-gray-100 text-gray-400'
            }`}
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleFeedback('bad')}
            className={`p-2 rounded-lg transition-colors ${
              feedback === 'bad'
                ? 'bg-red-100 text-red-600'
                : 'hover:bg-gray-100 text-gray-400'
            }`}
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}


