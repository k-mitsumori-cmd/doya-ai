'use client'

import { motion } from 'framer-motion'

interface Axis {
  label: string
  score: number
  comment: string
}

interface ShindanRadarChartProps {
  axes: Axis[]
}

export default function ShindanRadarChart({ axes }: ShindanRadarChartProps) {
  const count = axes.length
  const cx = 150
  const cy = 150
  const maxR = 120

  const getPoint = (index: number, radius: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  }

  const gridLevels = [20, 40, 60, 80, 100]

  const dataPoints = axes.map((a, i) => getPoint(i, (a.score / 100) * maxR))
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <svg viewBox="0 0 300 300" className="w-full max-w-[280px]">
          {/* グリッド */}
          {gridLevels.map((level) => {
            const r = (level / 100) * maxR
            const pts = Array.from({ length: count }, (_, i) => getPoint(i, r))
            const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
            return <path key={level} d={path} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
          })}
          {/* 軸線 */}
          {axes.map((_, i) => {
            const p = getPoint(i, maxR)
            return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
          })}
          {/* データ */}
          <motion.path
            d={dataPath}
            fill="rgba(20,184,166,0.2)"
            stroke="#14b8a6"
            strokeWidth="2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          />
          {/* データポイント */}
          {dataPoints.map((p, i) => (
            <motion.circle
              key={i} cx={p.x} cy={p.y} r="4"
              fill="#14b8a6" stroke="#ffffff" strokeWidth="2"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
            />
          ))}
          {/* ラベル */}
          {axes.map((a, i) => {
            const p = getPoint(i, maxR + 20)
            return (
              <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                className="fill-gray-600 text-[11px] font-bold">
                {a.label}
              </text>
            )
          })}
        </svg>
      </div>

      {/* 軸コメント */}
      <div className="grid grid-cols-2 gap-2">
        {axes.map((a, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">{a.label}</span>
              <span className="text-xs font-black text-teal-600">{a.score}</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">{a.comment}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
