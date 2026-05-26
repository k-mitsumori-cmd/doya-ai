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
      className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-600/5 via-blue-600/5 to-sky-500/5 border border-purple-200/50"
    >
      {/* Header stripe */}
      <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-sky-500" />

      <div className="p-5">
        {/* Title */}
        {title && (
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-purple-500 text-lg">auto_awesome</span>
            <h4 className="text-sm font-bold text-purple-700">{title}</h4>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 py-4">
            <div className="relative">
              <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
            </div>
            <div>
              <p className="text-sm font-medium text-purple-700">AIが分析中...</p>
              <p className="text-xs text-purple-400 mt-0.5">しばらくお待ちください</p>
            </div>
          </div>
        ) : (
          <>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
            {content && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
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
