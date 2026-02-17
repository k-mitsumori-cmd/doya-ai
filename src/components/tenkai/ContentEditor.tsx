'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'

// ============================================
// Types
// ============================================
interface ContentEditorProps {
  content: string
  platform: string
  onSave: (content: string) => void
  onCancel: () => void
}

// ============================================
// プラットフォームの文字数制限
// ============================================
const PLATFORM_LIMITS: Record<string, number> = {
  x: 280,
  instagram: 2200,
  line: 1000,
  facebook: 63206,
  linkedin: 3000,
  note: 50000,
  blog: 100000,
  newsletter: 10000,
  press_release: 10000,
}

// ============================================
// ContentEditor コンポーネント
// ============================================
export default function ContentEditor({
  content,
  platform,
  onSave,
  onCancel,
}: ContentEditorProps) {
  const [editedContent, setEditedContent] = useState(content)
  const charLimit = PLATFORM_LIMITS[platform] || 10000

  const charCount = editedContent.length
  const isOverLimit = charCount > charLimit
  const charPercentage = Math.min((charCount / charLimit) * 100, 100)

  // 変更があるか
  const hasChanges = editedContent !== content

  // プラットフォーム名
  const platformName = useMemo(() => {
    const names: Record<string, string> = {
      note: 'note',
      blog: 'Blog',
      x: 'X',
      instagram: 'Instagram',
      line: 'LINE',
      facebook: 'Facebook',
      linkedin: 'LinkedIn',
      newsletter: 'メルマガ',
      press_release: 'プレスリリース',
    }
    return names[platform] || platform
  }, [platform])

  // 保存
  const handleSave = useCallback(() => {
    if (!isOverLimit) {
      onSave(editedContent)
    }
  }, [editedContent, isOverLimit, onSave])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col"
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-blue-500">edit</span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">コンテンツを編集</h3>
            <p className="text-xs text-slate-400">{platformName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isOverLimit}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${
              hasChanges && !isOverLimit
                ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-sm hover:shadow-md'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            保存
          </button>
        </div>
      </div>

      {/* 分割ビュー */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* ========== 左: エディター ========== */}
        <div className="flex-1 flex flex-col border-r border-slate-200">
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              エディター
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold ${
                  isOverLimit ? 'text-red-500' : charPercentage > 90 ? 'text-amber-500' : 'text-slate-400'
                }`}
              >
                {charCount.toLocaleString()} / {charLimit.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex-1 relative">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-full px-6 py-4 text-sm text-slate-800 leading-relaxed resize-none focus:outline-none"
              placeholder="コンテンツを入力してください..."
            />
          </div>

          {/* 文字数バー */}
          <div className="px-4 py-2 border-t border-slate-100">
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full transition-colors ${
                  isOverLimit
                    ? 'bg-red-500'
                    : charPercentage > 90
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
                animate={{ width: `${charPercentage}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            {isOverLimit && (
              <p className="text-xs text-red-500 mt-1">
                文字数制限を {(charCount - charLimit).toLocaleString()} 文字超過しています
              </p>
            )}
          </div>
        </div>

        {/* ========== 右: プレビュー (フォンモックアップ) ========== */}
        <div className="flex-1 flex flex-col bg-slate-50 min-h-0">
          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              プレビュー
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
            {/* フォンモックアップ */}
            <div className="w-[320px] mx-auto">
              <div className="bg-white rounded-[2rem] border-4 border-slate-800 shadow-2xl overflow-hidden">
                {/* ノッチ */}
                <div className="flex justify-center pt-2 pb-1 bg-slate-800">
                  <div className="w-20 h-5 bg-slate-900 rounded-full" />
                </div>

                {/* スクリーンコンテンツ */}
                <div className="h-[480px] overflow-y-auto">
                  {/* ステータスバー */}
                  <div className="flex items-center justify-between px-5 py-2 text-[10px] text-slate-500">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">signal_cellular_alt</span>
                      <span className="material-symbols-outlined text-xs">wifi</span>
                      <span className="material-symbols-outlined text-xs">battery_full</span>
                    </div>
                  </div>

                  {/* アプリヘッダー */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500" />
                    <span className="text-xs font-semibold text-slate-800">{platformName}</span>
                  </div>

                  {/* プレビューコンテンツ */}
                  <div className="p-4">
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                      {editedContent || 'プレビューが表示されます...'}
                    </p>
                  </div>
                </div>

                {/* ホームバー */}
                <div className="flex justify-center py-2 bg-white">
                  <div className="w-28 h-1 bg-slate-800 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
