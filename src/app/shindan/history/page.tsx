'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, ChevronDown, ChevronUp, Trash2, Activity } from 'lucide-react'

interface HistoryEntry {
  id: string
  date: string
  industry: string
  department?: string
  monthlyBudget?: number
  overallScore: number
  overallGrade: string
  summary: string
  result: any
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('doya_shindan_history')
      if (stored) setHistory(JSON.parse(stored))
    } catch {}
  }, [])

  const handleDelete = (id: string) => {
    const updated = history.filter((h) => h.id !== id)
    setHistory(updated)
    localStorage.setItem('doya_shindan_history', JSON.stringify(updated))
  }

  const handleClearAll = () => {
    if (!confirm('すべての診断履歴を削除しますか？')) return
    setHistory([])
    localStorage.removeItem('doya_shindan_history')
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-teal-400" />
            <h1 className="text-2xl font-black">診断履歴</h1>
            <span className="text-xs font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
              {history.length}件
            </span>
          </div>
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              すべて削除
            </button>
          )}
        </div>

        {/* 履歴一覧 */}
        {history.length === 0 ? (
          <div className="text-center py-20">
            <Activity className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-lg font-bold text-slate-500">まだ診断履歴がありません</p>
            <p className="text-sm text-slate-600 mt-2">ビジネス診断を実行すると、ここに結果が保存されます</p>
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
              const isExpanded = expandedId === entry.id

              return (
                <motion.div
                  key={entry.id}
                  layout
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden"
                >
                  {/* ヘッダー行 */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-800/50 transition-colors text-left"
                  >
                    {/* グレード */}
                    <div className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center flex-shrink-0 ${gradeStyle}`}>
                      <span className="text-lg font-black leading-none">{entry.overallGrade}</span>
                      <span className="text-[10px] font-bold opacity-70">{entry.overallScore}</span>
                    </div>

                    {/* 情報 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-white">{entry.industry}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{entry.summary}</p>
                    </div>

                    {/* 日時 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-500">{formatDate(entry.date)}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {/* 展開時: 詳細 */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 border-t border-slate-800 pt-4">
                          {/* 6軸スコア */}
                          {entry.result?.axes && (
                            <div className="mb-4">
                              <h4 className="text-xs font-black text-slate-400 mb-2 uppercase tracking-wider">軸評価</h4>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {entry.result.axes.map((axis: any, i: number) => (
                                  <div key={i} className="bg-slate-800/50 rounded-lg px-3 py-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-slate-300">{axis.label}</span>
                                      <span className="text-sm font-black text-teal-400">{axis.score}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* ボトルネック */}
                          {entry.result?.bottlenecks && (
                            <div className="mb-4">
                              <h4 className="text-xs font-black text-slate-400 mb-2 uppercase tracking-wider">ボトルネック</h4>
                              <div className="space-y-1">
                                {entry.result.bottlenecks.map((b: any, i: number) => (
                                  <div key={i} className="text-xs text-slate-300 flex items-start gap-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      b.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                                      b.severity === 'medium' ? 'bg-orange-500/20 text-orange-400' :
                                      'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                      {b.severity === 'high' ? '高' : b.severity === 'medium' ? '中' : '低'}
                                    </span>
                                    <span>{b.title}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* アクション */}
                          <div className="flex items-center justify-between">
                            <a
                              href="/shindan"
                              className="text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors"
                            >
                              この条件で再診断 →
                            </a>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(entry.id) }}
                              className="text-xs font-bold text-red-400/60 hover:text-red-400 transition-colors"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
