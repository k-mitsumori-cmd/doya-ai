'use client'

import { motion } from 'framer-motion'

interface Bottleneck {
  title: string
  description: string
  severity: string
  impact: string
  estimatedLoss?: string
}

interface BottleneckPanelProps {
  bottlenecks: Bottleneck[]
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-50 border-red-200', text: 'text-red-600', label: '重大' },
  medium: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-600', label: '中程度' },
  low: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-600', label: '軽微' },
}

export default function BottleneckPanel({ bottlenecks }: BottleneckPanelProps) {
  return (
    <div className="space-y-3">
      {bottlenecks.map((b, i) => {
        const style = SEVERITY_STYLES[b.severity] || SEVERITY_STYLES['medium']
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`${style.bg} border rounded-xl p-4`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${style.text} bg-current/10`}>
                {style.label}
              </span>
              <h4 className="font-black text-gray-900">{b.title}</h4>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">{b.description}</p>
            <p className="text-xs text-gray-500">
              <span className="font-bold">影響:</span> {b.impact}
            </p>
            {b.estimatedLoss && (
              <p className="text-xs text-red-600 font-bold mt-1">
                推定損失: {b.estimatedLoss}
              </p>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
