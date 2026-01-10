'use client'

import { motion } from 'framer-motion'

export function LoadingProgress({ label }: { label: string }) {
  return (
    <div className="w-full max-w-md">
      <div className="text-slate-700 text-sm font-black mb-2">{label}</div>
      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
        <motion.div
          className="h-2 bg-gradient-to-r from-purple-600 to-pink-600"
          initial={{ width: '10%' }}
          animate={{ width: ['10%', '85%', '22%', '100%'] }}
          transition={{ duration: 2.2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
        />
      </div>
      <div className="mt-2 text-slate-500 text-xs font-bold">処理を進めています…（数十秒かかる場合があります）</div>
    </div>
  )
}




