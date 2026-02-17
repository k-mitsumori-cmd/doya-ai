'use client'

import { motion } from 'framer-motion'

// ============================================
// 入力方法の定義
// ============================================
const INPUT_METHODS = [
  {
    key: 'url' as const,
    icon: 'link',
    title: 'URL入力',
    description: '記事やWebページのURLを入力',
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
  },
  {
    key: 'text' as const,
    icon: 'description',
    title: 'テキスト入力',
    description: 'テキストを直接入力',
    color: 'from-emerald-500 to-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    iconColor: 'text-emerald-500',
  },
  {
    key: 'youtube' as const,
    icon: 'play_circle',
    title: 'YouTube',
    description: 'YouTube動画のURLを入力',
    color: 'from-red-500 to-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
  },
  {
    key: 'video' as const,
    icon: 'videocam',
    title: '動画ファイル',
    description: '動画ファイルをアップロード',
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    iconColor: 'text-purple-500',
  },
]

// ============================================
// Props
// ============================================
interface StepInputMethodProps {
  onSelect: (method: 'url' | 'text' | 'youtube' | 'video') => void
}

// ============================================
// StepInputMethod コンポーネント
// ============================================
export default function StepInputMethod({ onSelect }: StepInputMethodProps) {
  return (
    <div>
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-slate-900 mb-2">
          入力方法を選択
        </h2>
        <p className="text-slate-500">
          コンテンツの元となるソースを選んでください
        </p>
      </div>

      {/* カード選択グリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {INPUT_METHODS.map((method, index) => (
          <motion.button
            key={method.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
            onClick={() => onSelect(method.key)}
            className={`group relative p-6 rounded-2xl border-2 ${method.borderColor} bg-white hover:shadow-xl hover:scale-[1.02] transition-all duration-300 text-left`}
          >
            {/* アイコン */}
            <div
              className={`w-14 h-14 rounded-2xl ${method.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
            >
              <span className={`material-symbols-outlined text-3xl ${method.iconColor}`}>
                {method.icon}
              </span>
            </div>

            {/* タイトル + 説明 */}
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {method.title}
            </h3>
            <p className="text-sm text-slate-500">
              {method.description}
            </p>

            {/* ホバー矢印 */}
            <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="material-symbols-outlined text-slate-300 text-xl">
                arrow_forward
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
