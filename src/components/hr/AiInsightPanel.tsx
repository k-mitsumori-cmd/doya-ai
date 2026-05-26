'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface AiInsightPanelProps {
  loading?: boolean
  content: string
  title?: string
}

export default function AiInsightPanel({
  loading = false,
  content,
  title,
}: AiInsightPanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = content
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200"
    >
      {/* Header stripe */}
      <div className="h-1 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />

      <div className="p-5">
        {/* Title + AI label */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              auto_awesome
            </span>
            {title && (
              <h4 className="text-base font-black text-indigo-700">{title}</h4>
            )}
          </div>
          <span className="text-xs font-bold text-indigo-400 bg-indigo-100 px-3 py-1 rounded-full">
            AIが生成しました
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-4">
            <div className="relative">
              <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            </div>
            <div>
              <p className="text-base font-bold text-indigo-700">AIが分析中...</p>
              <p className="text-sm font-semibold text-indigo-400 mt-0.5">しばらくお待ちください</p>
            </div>
          </div>
        ) : (
          <>
            <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
            {content && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-indigo-600 bg-white hover:bg-indigo-100 rounded-full shadow-sm hover:shadow-md transition-all"
                >
                  <span className="material-symbols-outlined text-base">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  {copied ? 'コピーしました' : 'コピー'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
