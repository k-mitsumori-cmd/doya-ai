'use client'

import { motion } from 'framer-motion'

interface BenchmarkItem {
  category: string
  yourScore: number
  industryAverage: number
}

interface BenchmarkChartProps {
  benchmark: BenchmarkItem[]
}

export default function BenchmarkChart({ benchmark }: BenchmarkChartProps) {
  return (
    <div className="space-y-4">
      {benchmark.map((item, i) => {
        const diff = item.yourScore - item.industryAverage
        const isAbove = diff >= 0
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-300">{item.category}</span>
              <span className={`text-xs font-black ${isAbove ? 'text-emerald-400' : 'text-orange-400'}`}>
                {isAbove ? '+' : ''}{diff}pt
              </span>
            </div>
            <div className="relative h-6 bg-slate-800 rounded-full overflow-hidden">
              {/* 業界平均 */}
              <div
                className="absolute top-0 h-full bg-slate-700 rounded-full"
                style={{ width: `${item.industryAverage}%` }}
              />
              {/* あなたのスコア */}
              <motion.div
                className={`absolute top-0 h-full rounded-full ${isAbove ? 'bg-teal-500/80' : 'bg-orange-500/80'}`}
                initial={{ width: 0 }}
                animate={{ width: `${item.yourScore}%` }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
              />
              {/* 業界平均マーカー */}
              <div
                className="absolute top-0 h-full w-0.5 bg-white/40"
                style={{ left: `${item.industryAverage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>あなた: <span className="font-black text-white">{item.yourScore}</span></span>
              <span>業界平均: <span className="font-bold">{item.industryAverage}</span></span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
