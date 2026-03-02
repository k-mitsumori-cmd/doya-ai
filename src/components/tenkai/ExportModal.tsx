'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================
// Types
// ============================================
type ExportFormat = 'markdown' | 'html' | 'plaintext' | 'json'

interface ExportModalProps {
  outputId: string
  platform: string
  isOpen: boolean
  onClose: () => void
}

// ============================================
// フォーマット定義
// ============================================
const FORMATS: {
  key: ExportFormat
  label: string
  icon: string
  description: string
  extension: string
}[] = [
  {
    key: 'markdown',
    label: 'Markdown',
    icon: 'code',
    description: 'Markdown形式でエクスポート (.md)',
    extension: '.md',
  },
  {
    key: 'html',
    label: 'HTML',
    icon: 'html',
    description: 'HTML形式でエクスポート (.html)',
    extension: '.html',
  },
  {
    key: 'plaintext',
    label: 'プレーンテキスト',
    icon: 'text_snippet',
    description: 'テキスト形式でエクスポート (.txt)',
    extension: '.txt',
  },
  {
    key: 'json',
    label: 'JSON',
    icon: 'data_object',
    description: 'JSON形式でエクスポート (.json)',
    extension: '.json',
  },
]

// ============================================
// プラットフォーム名
// ============================================
const PLATFORM_NAMES: Record<string, string> = {
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

// ============================================
// ExportModal コンポーネント
// ============================================
export default function ExportModal({
  outputId,
  platform,
  isOpen,
  onClose,
}: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown')
  const [preview, setPreview] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const platformName = PLATFORM_NAMES[platform] || platform

  // ============================================
  // プレビュー取得
  // ============================================
  useEffect(() => {
    if (!isOpen) return

    const fetchPreview = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // API は POST のみ。format名は plaintext → text に変換
        const apiFormat = selectedFormat === 'plaintext' ? 'text' : selectedFormat
        const res = await fetch(
          `/api/tenkai/outputs/${outputId}/export`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ format: apiFormat }),
          }
        )

        if (!res.ok) {
          throw new Error('プレビューの取得に失敗しました')
        }

        // API は生のテキストを返す（JSON wrapper ではない）
        const text = await res.text()
        setPreview(text || '')
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました')
        setPreview('')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPreview()
  }, [isOpen, outputId, selectedFormat])

  // ============================================
  // ダウンロード
  // ============================================
  const handleDownload = useCallback(() => {
    if (!preview) return

    const format = FORMATS.find((f) => f.key === selectedFormat)
    const mimeTypes: Record<ExportFormat, string> = {
      markdown: 'text/markdown',
      html: 'text/html',
      plaintext: 'text/plain',
      json: 'application/json',
    }

    const blob = new Blob([preview], { type: mimeTypes[selectedFormat] })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${platformName}_${outputId}${format?.extension || '.txt'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [preview, selectedFormat, platformName, outputId])

  // ============================================
  // クリップボードにコピー
  // ============================================
  const handleCopy = useCallback(async () => {
    if (!preview) return

    try {
      await navigator.clipboard.writeText(preview)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }, [preview])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* バックドロップ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* モーダル */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
              {/* ヘッダー */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-500">download</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">エクスポート</h3>
                    <p className="text-xs text-slate-400">{platformName}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* コンテンツ */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* フォーマット選択 */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    出力フォーマット
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {FORMATS.map((format) => (
                      <button
                        key={format.key}
                        onClick={() => setSelectedFormat(format.key)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          selectedFormat === format.key
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-2xl mb-1 ${
                            selectedFormat === format.key ? 'text-blue-500' : 'text-slate-400'
                          }`}
                        >
                          {format.icon}
                        </span>
                        <p
                          className={`text-xs font-bold ${
                            selectedFormat === format.key ? 'text-blue-600' : 'text-slate-700'
                          }`}
                        >
                          {format.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* プレビュー */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    プレビュー
                  </p>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 max-h-60 overflow-y-auto">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <motion.span
                          className="material-symbols-outlined text-2xl text-blue-500"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          progress_activity
                        </motion.span>
                      </div>
                    ) : error ? (
                      <div className="flex items-center gap-2 py-4">
                        <span className="material-symbols-outlined text-red-500">error</span>
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    ) : (
                      <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap break-all leading-relaxed">
                        {preview || 'プレビューデータがありません'}
                      </pre>
                    )}
                  </div>
                </div>
              </div>

              {/* フッター */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
                <button
                  onClick={handleCopy}
                  disabled={!preview || isLoading}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    preview && !isLoading
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  {copied ? 'コピーしました' : 'クリップボードにコピー'}
                </button>

                <button
                  onClick={handleDownload}
                  disabled={!preview || isLoading}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    preview && !isLoading
                      ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">download</span>
                  ダウンロード
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
