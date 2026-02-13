'use client'

import { motion } from 'framer-motion'

interface ScoreCardProps {
  score: number
  grade: string
  summary: string
}

const GRADE_COLORS: Record<string, string> = {
  S: 'from-amber-400 to-yellow-500',
  A: 'from-emerald-400 to-teal-500',
  B: 'from-blue-400 to-cyan-500',
  C: 'from-orange-400 to-amber-500',
  D: 'from-red-400 to-rose-500',
}

export default function ScoreCard({ score, grade, summary }: ScoreCardProps) {
  const gradient = GRADE_COLORS[grade] || GRADE_COLORS['C']
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* 円形スコア */}
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="8" />
            <motion.circle
              cx="60" cy="60" r="54" fill="none"
              stroke="url(#scoreGradient)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-gray-900 tabular-nums">{score}</span>
            <span className="text-xs text-gray-500 font-bold">/ 100</span>
          </div>
        </div>

        {/* グレード + サマリ */}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center gap-3 justify-center sm:justify-start mb-3">
            <span className={`px-4 py-1.5 rounded-xl bg-gradient-to-r ${gradient} text-white text-xl font-black shadow-lg`}>
              {grade}
            </span>
            <span className="text-sm text-gray-500 font-bold">総合評価</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
        </div>
      </div>
    </motion.div>
  )
}
