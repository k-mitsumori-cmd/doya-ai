'use client'

import { motion } from 'framer-motion'

interface CompetitiveMatrixProps {
  websiteHealth: any
  competitors: any[]
  detailedComparison?: any
}

export default function CompetitiveMatrix({ websiteHealth, competitors, detailedComparison }: CompetitiveMatrixProps) {
  if (!websiteHealth?.tracking && (!competitors || competitors.length === 0)) return null

  const items = detailedComparison?.items || competitors || []
  if (items.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6"
    >
      <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-white">
        <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 text-sm">📊</span>
        競合分析マトリクス
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-3 text-slate-400 font-bold">項目</th>
              <th className="text-center py-2 px-3 text-teal-400 font-bold">自社</th>
              {items.slice(0, 3).map((c: any, i: number) => (
                <th key={i} className="text-center py-2 px-3 text-slate-400 font-bold truncate max-w-[120px]">
                  {c.name || c.domain || `競合${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {['SEO対策', 'コンテンツ', 'パフォーマンス', 'モバイル対応'].map((label, ri) => (
              <tr key={label} className="border-b border-slate-800/50">
                <td className="py-2.5 px-3 text-slate-300 font-medium">{label}</td>
                <td className="py-2.5 px-3 text-center">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-400">
                    {websiteHealth?.scores?.[ri] || '—'}
                  </span>
                </td>
                {items.slice(0, 3).map((c: any, ci: number) => (
                  <td key={ci} className="py-2.5 px-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300">
                      {c.scores?.[ri] || c.score || '—'}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailedComparison?.summary && (
        <p className="mt-4 text-sm text-slate-400 leading-relaxed">{detailedComparison.summary}</p>
      )}
    </motion.div>
  )
}
