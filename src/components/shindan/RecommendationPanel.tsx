'use client'

import { motion } from 'framer-motion'

interface Recommendation {
  title: string
  description: string
  priority: string
  estimatedCost: string
  estimatedEffect: string
  timeframe: string
}

interface RecommendationPanelProps {
  recommendations: Recommendation[]
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-teal-500/10 border-teal-500/30', text: 'text-teal-400', label: '最優先' },
  medium: { bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400', label: '推奨' },
  low: { bg: 'bg-slate-700/50 border-slate-600', text: 'text-slate-400', label: '検討' },
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
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                {i + 1}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${style.text}`}>
                {style.label}
              </span>
              <h4 className="font-black text-white">{r.title}</h4>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">{r.description}</p>
            <div className="flex flex-wrap gap-3 text-[11px]">
              <span className="text-slate-500">
                <span className="font-bold">コスト:</span> <span className="text-slate-300">{r.estimatedCost}</span>
              </span>
              <span className="text-slate-500">
                <span className="font-bold">効果:</span> <span className="text-slate-300">{r.estimatedEffect}</span>
              </span>
              <span className="text-slate-500">
                <span className="font-bold">期間:</span> <span className="text-slate-300">{r.timeframe}</span>
              </span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
