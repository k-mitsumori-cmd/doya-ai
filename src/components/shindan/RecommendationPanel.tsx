'use client'

import { motion } from 'framer-motion'

interface Recommendation {
  title: string
  description: string
  priority: string
  estimatedCost: string
  estimatedEffect: string
  timeframe: string
  quickWin?: boolean
}

interface RecommendationPanelProps {
  recommendations: Recommendation[]
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-600', label: '最優先' },
  medium: { bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-600', label: '推奨' },
  low: { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-500', label: '検討' },
}

export default function RecommendationPanel({ recommendations }: RecommendationPanelProps) {
  return (
    <div className="space-y-3">
      {recommendations.map((r, i) => {
        const style = PRIORITY_STYLES[r.priority] || PRIORITY_STYLES['medium']
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`${style.bg} border rounded-xl p-4`}
          >
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                {i + 1}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${style.text}`}>
                {style.label}
              </span>
              {r.quickWin && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-200">
                  Quick Win
                </span>
              )}
              <h4 className="font-black text-gray-900">{r.title}</h4>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">{r.description}</p>
            <div className="flex flex-wrap gap-3 text-[11px]">
              <span className="text-gray-400">
                <span className="font-bold">コスト:</span> <span className="text-gray-600">{r.estimatedCost}</span>
              </span>
              <span className="text-gray-400">
                <span className="font-bold">効果:</span> <span className="text-gray-600">{r.estimatedEffect}</span>
              </span>
              <span className="text-gray-400">
                <span className="font-bold">期間:</span> <span className="text-gray-600">{r.timeframe}</span>
              </span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
