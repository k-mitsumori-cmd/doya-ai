'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, ChevronRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { getActiveBanners, Banner } from '@/lib/banners'

interface PromoBannerProps {
  position: Banner['position']
  className?: string
}

export function PromoBanner({ position, className = '' }: PromoBannerProps) {
  const [banners, setBanners] = useState<Banner[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    const activeBanners = getActiveBanners(position)
    setBanners(activeBanners)

    // ローカルストレージから非表示にしたバナーを取得
    const dismissedStr = localStorage.getItem(`dismissed_banners_${position}`)
    if (dismissedStr) {
      setDismissed(JSON.parse(dismissedStr))
    }
  }, [position])

  // フィルタリングされたバナー
  const visibleBanners = banners.filter((b) => !dismissed.includes(b.id))

  // 自動スライド（複数バナーがある場合）
  useEffect(() => {
    if (visibleBanners.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleBanners.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [visibleBanners.length])

  const handleDismiss = (bannerId: string) => {
    const newDismissed = [...dismissed, bannerId]
    setDismissed(newDismissed)
    localStorage.setItem(`dismissed_banners_${position}`, JSON.stringify(newDismissed))
  }

  if (visibleBanners.length === 0) return null

  const banner = visibleBanners[currentIndex]

  // ポジションに応じたレンダリング
  if (position === 'dashboard_top') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl shadow-lg ${className}`}
        style={{ background: banner.backgroundColor }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative px-6 py-5 flex items-center gap-6">
          {/* アイコン/画像 */}
          <div className="hidden sm:flex w-16 h-16 rounded-xl bg-white/20 items-center justify-center flex-shrink-0">
            <Sparkles className="w-8 h-8" style={{ color: banner.textColor }} />
          </div>

          {/* コンテンツ */}
          <div className="flex-1 min-w-0">
            <h3 
              className="text-lg font-bold mb-1"
              style={{ color: banner.textColor }}
            >
              {banner.title}
            </h3>
            <p 
              className="text-sm opacity-90 line-clamp-2"
              style={{ color: banner.textColor }}
            >
              {banner.description}
            </p>
          </div>

          {/* CTA */}
          <a
            href={banner.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white rounded-xl font-medium text-gray-900 hover:bg-gray-100 transition-colors shadow-md"
          >
            {banner.linkText}
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* 閉じるボタン */}
          <button
            onClick={() => handleDismiss(banner.id)}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/30 transition-colors"
            style={{ color: banner.textColor }}
          >
            <X className="w-4 h-4" />
          </button>

          {/* インジケーター（複数バナーの場合） */}
          {visibleBanners.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {visibleBanners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentIndex ? 'bg-white w-4' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  if (position === 'dashboard_side') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className={`relative overflow-hidden rounded-xl shadow-md ${className}`}
        style={{ background: banner.backgroundColor }}
      >
        <div className="p-4">
          <button
            onClick={() => handleDismiss(banner.id)}
            className="absolute top-2 right-2 p-1 rounded-full bg-black/20 hover:bg-black/30 transition-colors"
            style={{ color: banner.textColor }}
          >
            <X className="w-3 h-3" />
          </button>

          <h4 
            className="font-bold text-sm mb-2 pr-6"
            style={{ color: banner.textColor }}
          >
            {banner.title}
          </h4>
          <p 
            className="text-xs opacity-90 mb-3 line-clamp-3"
            style={{ color: banner.textColor }}
          >
            {banner.description}
          </p>
          <a
            href={banner.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            style={{ color: banner.textColor }}
          >
            {banner.linkText}
            <ChevronRight className="w-3 h-3" />
          </a>
        </div>
      </motion.div>
    )
  }

  if (position === 'after_generation') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-xl border ${className}`}
        style={{ 
          background: banner.backgroundColor,
          borderColor: 'rgba(255,255,255,0.2)'
        }}
      >
        <div className="p-4 flex items-center gap-4">
          <div className="flex-1">
            <h4 
              className="font-bold text-sm mb-1"
              style={{ color: banner.textColor }}
            >
              {banner.title}
            </h4>
            <p 
              className="text-xs opacity-80"
              style={{ color: banner.textColor }}
            >
              {banner.description}
            </p>
          </div>
          <a
            href={banner.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-white rounded-lg text-gray-900 hover:bg-gray-100 transition-colors"
          >
            {banner.linkText}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => handleDismiss(banner.id)}
            className="p-1 rounded-full hover:bg-black/20 transition-colors"
            style={{ color: banner.textColor }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    )
  }

  // デフォルト（template_list など）
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{ background: banner.backgroundColor }}
    >
      <div className="p-4 flex items-center justify-between gap-4">
        <div>
          <h4 className="font-bold" style={{ color: banner.textColor }}>
            {banner.title}
          </h4>
          <p className="text-sm opacity-80" style={{ color: banner.textColor }}>
            {banner.description}
          </p>
        </div>
        <a
          href={banner.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg font-medium text-gray-900 hover:bg-gray-100 transition-colors"
        >
          {banner.linkText}
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </motion.div>
  )
}

// シンプルなバナー（サイドバー用）
export function SidebarPromoBanner() {
  const [banner, setBanner] = useState<Banner | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const banners = getActiveBanners('dashboard_side')
    if (banners.length > 0) {
      setBanner(banners[0])
    }

    // 非表示チェック
    const dismissedStr = localStorage.getItem('sidebar_promo_dismissed')
    if (dismissedStr === 'true') {
      setDismissed(true)
    }
  }, [])

  if (!banner || dismissed) return null

  return (
    <div 
      className="rounded-xl p-3 relative"
      style={{ background: banner.backgroundColor }}
    >
      <button
        onClick={() => {
          setDismissed(true)
          localStorage.setItem('sidebar_promo_dismissed', 'true')
        }}
        className="absolute top-1 right-1 p-1 rounded-full hover:bg-black/20"
        style={{ color: banner.textColor }}
      >
        <X className="w-3 h-3" />
      </button>
      <p 
        className="text-xs font-medium mb-1 pr-4"
        style={{ color: banner.textColor }}
      >
        {banner.title}
      </p>
      <a
        href={banner.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs underline opacity-80 hover:opacity-100"
        style={{ color: banner.textColor }}
      >
        {banner.linkText} →
      </a>
    </div>
  )
}


