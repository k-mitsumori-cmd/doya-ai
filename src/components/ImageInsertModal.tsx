'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Image as ImageIcon, X, Upload, Link2 } from 'lucide-react'

export function ImageInsertModal({
  open,
  onClose,
  onInsert,
}: {
  open: boolean
  onClose: () => void
  onInsert: (imageMarkdown: string) => void
}) {
  const [imageUrl, setImageUrl] = useState('')
  const [altText, setAltText] = useState('')
  const [title, setTitle] = useState('')

  const handleInsert = () => {
    if (!imageUrl) return
    const markdown = title
      ? `![${altText || '画像'}](${imageUrl} "${title}")`
      : `![${altText || '画像'}](${imageUrl})`
    onInsert(markdown)
    onClose()
    // リセット
    setImageUrl('')
    setAltText('')
    setTitle('')
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl shadow-2xl border-2 border-slate-200 w-full max-w-2xl"
          >
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-pink-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">図を挿入</h3>
                    <p className="text-sm text-slate-600 font-bold">画像URLを入力して記事に追加</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/50 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <Link2 className="w-4 h-4 inline mr-1" />
                  画像URL
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  代替テキスト（alt）
                </label>
                <input
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="画像の説明"
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  タイトル（オプション）
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="画像のタイトル"
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none font-medium"
                />
              </div>

              {imageUrl && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-600 mb-2">プレビュー:</p>
                  <img
                    src={imageUrl}
                    alt={altText || 'プレビュー'}
                    className="max-w-full h-auto rounded-lg border border-slate-200"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl bg-white border-2 border-slate-300 text-slate-700 font-black hover:bg-slate-50 transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={handleInsert}
                disabled={!imageUrl}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-black shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                図を挿入
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

