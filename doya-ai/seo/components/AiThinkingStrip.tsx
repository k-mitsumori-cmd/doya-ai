'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Activity, BrainCircuit, Sparkles, Target, Zap } from 'lucide-react'

type Props = {
  show: boolean
  title?: string
  subtitle?: string
  tags?: Array<'SEO' | 'LLMO' | '構造化' | '網羅性' | '読みやすさ'>
  steps?: string[]
  compact?: boolean
}

export function AiThinkingStrip({
  show,
  title = 'AIが思考中…',
  subtitle = 'SEO / LLMOの観点で、構造・網羅性・読みやすさを最適化しています',
  tags = ['SEO', 'LLMO', '構造化'],
  steps,
  compact = false,
}: Props) {
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          key="ai-thinking-strip"
          initial={{ opacity: 0, y: 10, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.995 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={`relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm ${
            compact ? 'p-4' : 'p-5 sm:p-6'
          }`}
        >
          {/* moving gradient */}
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              className="absolute -inset-16 opacity-[0.18]"
              style={{
                background:
                  'conic-gradient(from 90deg at 50% 50%, #2563eb, #7c3aed, #10b981, #f59e0b, #2563eb)',
              }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 6.5, ease: 'linear' }}
            />
            <div className="absolute inset-0 bg-white/80" />
          </div>

          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-black text-gray-900 truncate">{title}</p>
                    <p className="text-[11px] sm:text-xs font-bold text-gray-600 mt-1 leading-relaxed">{subtitle}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-[10px] font-black text-gray-700"
                    >
                      {t === 'SEO' ? <Target className="w-3.5 h-3.5 text-blue-600" /> : null}
                      {t === 'LLMO' ? <Zap className="w-3.5 h-3.5 text-indigo-600" /> : null}
                      {t === '構造化' ? <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> : null}
                      {t === '網羅性' ? <Sparkles className="w-3.5 h-3.5 text-amber-600" /> : null}
                      {t === '読みやすさ' ? <Sparkles className="w-3.5 h-3.5 text-rose-600" /> : null}
                      <span>{t}</span>
                    </span>
                  ))}
                  <span className="ml-auto inline-flex items-center gap-2 text-[10px] font-black text-gray-500">
                    <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                    思考中
                  </span>
                </div>
              </div>
            </div>

            {!!steps?.length && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {steps.slice(0, 4).map((s) => (
                  <div key={s} className="p-3 rounded-2xl bg-white/80 border border-gray-100">
                    <p className="text-[11px] font-black text-gray-800">{s}</p>
                    <motion.div
                      className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden border border-gray-200"
                      initial={false}
                    >
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600"
                        initial={{ x: '-65%' }}
                        animate={{ x: '120%' }}
                        transition={{ repeat: Infinity, duration: 1.35, ease: 'linear' }}
                        style={{ width: '45%' }}
                      />
                    </motion.div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}


