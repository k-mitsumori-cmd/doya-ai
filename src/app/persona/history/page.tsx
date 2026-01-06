'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Trash2, ExternalLink, Clock, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import { ctaMotion, pageMount, stagger, staggerItem, usePersonaMotionMode } from '@/components/persona/PersonaMotion'

interface HistoryItem {
  data: {
    persona: {
      name: string
      occupation: string
      age: number
      gender: string
    }
  }
  url: string
  timestamp: number
  portrait?: string
}

export default function PersonaHistoryPage() {
  const motionMode = usePersonaMotionMode()
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('doya_persona_history')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setHistory(Array.isArray(parsed) ? parsed : [])
      } catch {}
    }
  }, [])

  const deleteItem = (index: number) => {
    const newHistory = history.filter((_, i) => i !== index)
    setHistory(newHistory)
    localStorage.setItem('doya_persona_history', JSON.stringify(newHistory))
  }

  const loadItem = (item: HistoryItem) => {
    localStorage.setItem('doya_persona_last', JSON.stringify(item))
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const clearAll = () => {
    if (confirm('すべての履歴を削除しますか？')) {
      setHistory([])
      localStorage.removeItem('doya_persona_history')
    }
  }

  return (
    <motion.div variants={pageMount} initial="initial" animate="animate" className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 flex items-center gap-3">
              <Clock className="w-7 h-7 text-purple-400" />
              生成履歴
            </h1>
            <p className="text-slate-400 text-sm mt-1">過去に生成したペルソナの一覧</p>
          </div>
          {history.length > 0 && (
            <motion.button
              onClick={clearAll}
              className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
              {...ctaMotion(motionMode)}
            >
              すべて削除
            </motion.button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
              <Target className="w-10 h-10 text-slate-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">履歴がありません</h2>
            <p className="text-slate-600 mb-6 text-sm">ペルソナを生成すると、ここに履歴が表示されます</p>
            <motion.div className="inline-flex" {...ctaMotion(motionMode)}>
              <Link
                href="/persona"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg"
              >
                ペルソナを生成する
              </Link>
            </motion.div>
          </div>
        ) : (
          <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-3">
            {history.map((item, index) => (
              <motion.div
                key={index}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors shadow-sm"
                variants={staggerItem}
              >
                <div className="flex items-center gap-4">
                  {/* Portrait */}
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/30 overflow-hidden flex-shrink-0">
                    {item.portrait ? (
                      <img src={item.portrait} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl text-slate-600">
                        👤
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {item.data?.persona?.name || '不明'}
                    </h3>
                    <p className="text-sm text-slate-600 truncate">
                      {item.data?.persona?.age}歳 / {item.data?.persona?.gender} / {item.data?.persona?.occupation}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {item.url}
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-500">{formatDate(item.timestamp)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Link
                        href="/persona"
                        onClick={() => loadItem(item)}
                        className="p-2 text-purple-400 hover:bg-purple-900/30 rounded-lg transition-colors"
                        title="読み込む"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </Link>
                      <motion.button
                        onClick={() => deleteItem(index)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                        title="削除"
                        {...ctaMotion(motionMode)}
                      >
                        <Trash2 className="w-5 h-5" />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
