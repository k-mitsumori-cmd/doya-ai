'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, Globe } from 'lucide-react'

interface UrlInputFormProps {
  onSubmit: (url: string) => void
  isLoading?: boolean
}

export default function UrlInputForm({ onSubmit, isLoading }: UrlInputFormProps) {
  const [url, setUrl] = useState('')

  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!url.trim() || isLoading) return
    let finalUrl = url.trim()
    if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl
    try {
      new URL(finalUrl)
    } catch {
      setError('有効なURLを入力してください')
      return
    }
    onSubmit(finalUrl)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}
      <div className="relative group">
        {/* Glow border */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-[#EF4343] to-[#DC2626] rounded-2xl opacity-20 group-hover:opacity-40 blur transition-opacity" />

        <div className="relative flex items-center bg-[#1a0d0d] border border-[#2d1616] rounded-2xl overflow-hidden">
          <Globe className="ml-5 h-5 w-5 text-white/30 flex-shrink-0" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="サイトのURLを入力してください"
            className="flex-1 bg-transparent px-4 py-5 text-lg text-white placeholder-white/30 outline-none"
            disabled={isLoading}
          />
          <motion.button
            type="submit"
            disabled={!url.trim() || isLoading}
            className="m-2 flex items-center gap-2 rounded-xl bg-[#EF4343] px-6 py-3 font-bold text-white shadow-lg shadow-[#EF4343]/20 transition-all hover:shadow-[#EF4343]/40 disabled:opacity-40 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                生成する
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        </div>
      </div>
    </form>
  )
}
