'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, ChevronDown, ChevronUp, Trash2, Activity, Globe } from 'lucide-react'

interface HistoryEntry {
  id: string
  url: string
  industry: string
  overallScore: number
  overallGrade: string
  createdAt: string
  // legacy fields
  date?: string
  summary?: string
  result?: any
}

const GRADE_COLORS: Record<string, string> = {
  S: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  A: 'text-teal-400 bg-teal-400/10 border-teal-400/30',
  B: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  C: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  D: 'text-red-400 bg-red-400/10 border-red-400/30',
}

export default function ShindanHistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('shindan_history')
      if (stored) setHistory(JSON.parse(stored))
    } catch {}
  }, [])

  const handleDelete = (id: string) => {
    const updated = history.filter((h) => h.id !== id)
    setHistory(updated)
    localStorage.setItem('shindan_history', JSON.stringify(updated))
  }

  const handleClearAll = () => {
    if (!confirm('すべての診断履歴を削除しますか？')) return
    setHistory([])
    localStorage.removeItem('shindan_history')
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const getHostname = (url: string) => {
    try { return new URL(url).hostname.replace('www.', '') } catch { return url }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-teal-600" />
            <h1 className="text-2xl font-black text-gray-900">Web診断履歴</h1>
            <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
              {history.length}件
            </span>
          </div>
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              すべて削除
            </button>
          )}
        </div>

        {/* 履歴一覧 */}
        {history.length === 0 ? (
          <div className="text-center py-20">
            <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-bold text-gray-400">まだ診断履歴がありません</p>
            <p className="text-sm text-gray-400 mt-2">Web診断を実行すると、ここに結果が保存されます</p>
            <a
              href="/shindan"
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all"
            >
              <Activity className="w-5 h-5" />
              診断を始める
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => {
              const gradeStyle = GRADE_COLORS[entry.overallGrade] || GRADE_COLORS.C

              return (
                <motion.div
                  key={entry.id}
                  layout
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* グレード */}
                    <div className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center flex-shrink-0 ${gradeStyle}`}>
                      <span className="text-lg font-black leading-none">{entry.overallGrade}</span>
                      <span className="text-[10px] font-bold opacity-70">{entry.overallScore}</span>
                    </div>

                    {/* 情報 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-black text-gray-900 truncate">
                          {entry.url ? getHostname(entry.url) : entry.industry || '-'}
                        </span>
                        {entry.industry && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded hidden sm:inline-block">
                            {entry.industry}
                          </span>
                        )}
                      </div>
                      {entry.url && (
                        <p className="text-xs text-gray-400 truncate">{entry.url}</p>
                      )}
                    </div>

                    {/* 日時 + 削除 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">
                        {formatDate(entry.createdAt || entry.date || '')}
                      </span>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
