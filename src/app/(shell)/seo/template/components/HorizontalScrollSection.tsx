'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ArticleSection, ArticleTemplate } from '../types'
import { ArticleCard } from './ArticleCard'

interface HorizontalScrollSectionProps {
  section: ArticleSection
  selectedTemplateId: string | null
  onSelectTemplate: (template: ArticleTemplate) => void
}

export function HorizontalScrollSection({
  section,
  selectedTemplateId,
  onSelectTemplate,
}: HorizontalScrollSectionProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [scrollPosition, setScrollPosition] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  })
  const touchStartX = useRef<number>(0)
  const touchCurrentX = useRef<number>(0)
  const isDragging = useRef<boolean>(false)

  // スクロール位置を更新
  const updateScrollPosition = useCallback(() => {
    const container = scrollRef.current
    if (container) {
      const canScrollLeft = container.scrollLeft > 10
      const canScrollRight =
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      setScrollPosition({ canScrollLeft, canScrollRight })
    }
  }, [])

  // スクロール関数
  const scroll = useCallback(
    (direction: 'left' | 'right') => {
      const container = scrollRef.current
      if (container) {
        const cardWidth =
          window.innerWidth < 640
            ? 144
            : window.innerWidth < 768
              ? 192
              : window.innerWidth < 1024
                ? 256
                : 320
        const gap = window.innerWidth < 640 ? 8 : window.innerWidth < 768 ? 12 : 16
        const scrollAmount = (cardWidth + gap) * 2 // 2枚分スクロール

        container.scrollBy({
          left: direction === 'left' ? -scrollAmount : scrollAmount,
          behavior: 'smooth',
        })

        setTimeout(() => updateScrollPosition(), 400)
      }
    },
    [updateScrollPosition]
  )

  // スクロールイベントハンドラ
  const handleScroll = useCallback(() => {
    updateScrollPosition()
  }, [updateScrollPosition])

  // 初期スクロール位置を設定
  useEffect(() => {
    const timer = setTimeout(() => {
      updateScrollPosition()
    }, 100)
    return () => clearTimeout(timer)
  }, [updateScrollPosition])

  // タッチスワイプハンドラ
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchCurrentX.current = e.touches[0].clientX
    isDragging.current = true
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return
    e.preventDefault()

    touchCurrentX.current = e.touches[0].clientX
    const container = scrollRef.current
    if (container) {
      const diff = touchStartX.current - touchCurrentX.current
      container.scrollLeft += diff
      touchStartX.current = touchCurrentX.current
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false

    const container = scrollRef.current
    if (container) {
      const diff = touchStartX.current - touchCurrentX.current
      if (Math.abs(diff) > 30) {
        const cardWidth =
          window.innerWidth < 640
            ? 144
            : window.innerWidth < 768
              ? 192
              : window.innerWidth < 1024
                ? 256
                : 320
        const scrollAmount = Math.min(Math.abs(diff) * 1.5, cardWidth * 2)
        container.scrollBy({
          left: diff > 0 ? scrollAmount : -scrollAmount,
          behavior: 'smooth',
        })
      }
      setTimeout(() => updateScrollPosition(), 300)
    }
  }, [updateScrollPosition])

  // マウスドラッグハンドラ
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return

    touchStartX.current = e.clientX
    touchCurrentX.current = e.clientX
    isDragging.current = true

    const container = scrollRef.current
    if (container) {
      container.style.cursor = 'grabbing'
      container.style.userSelect = 'none'
    }

    // グローバルイベントリスナー
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      e.preventDefault()

      touchCurrentX.current = e.clientX
      const container = scrollRef.current
      if (container) {
        const diff = touchStartX.current - touchCurrentX.current
        container.scrollLeft += diff
        touchStartX.current = touchCurrentX.current
      }
    }

    const handleGlobalMouseUp = () => {
      isDragging.current = false
      const container = scrollRef.current
      if (container) {
        container.style.cursor = 'grab'
        container.style.userSelect = ''
      }
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }

    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    const container = scrollRef.current
    if (container) {
      container.style.cursor = 'grab'
      container.style.userSelect = ''
    }
  }, [])

  // マウスホイール/トラックパッド対応
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const container = scrollRef.current
      if (!container) return

      const hasHorizontalScroll = container.scrollWidth > container.clientWidth
      if (!hasHorizontalScroll) return

      // トラックパッドの横スワイプを検出
      if (e.deltaX !== 0) {
        requestAnimationFrame(() => {
          if (container) {
            container.scrollLeft += e.deltaX * 3
            updateScrollPosition()
          }
        })
        return
      }

      // Shiftキー + 縦スクロールの場合
      if (e.shiftKey && e.deltaY !== 0) {
        e.preventDefault()
        requestAnimationFrame(() => {
          if (container) {
            container.scrollLeft += e.deltaY * 3
            updateScrollPosition()
          }
        })
      }
    },
    [updateScrollPosition]
  )

  // キーボード操作対応（矢印キーでスクロール）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const container = scrollRef.current
      if (!container) return

      const hasHorizontalScroll = container.scrollWidth > container.clientWidth
      if (!hasHorizontalScroll) return

      // フォーカスがコンテナ内にある場合のみ処理
      if (document.activeElement !== container && !container.contains(document.activeElement)) {
        return
      }

      const cardWidth =
        window.innerWidth < 640
          ? 192
          : window.innerWidth < 768
            ? 256
            : window.innerWidth < 1024
              ? 320
              : 384
      const gap = window.innerWidth < 640 ? 8 : window.innerWidth < 768 ? 12 : 16
      const scrollAmount = cardWidth + gap

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        container.scrollBy({
          left: -scrollAmount,
          behavior: 'smooth',
        })
        setTimeout(() => updateScrollPosition(), 300)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        container.scrollBy({
          left: scrollAmount,
          behavior: 'smooth',
        })
        setTimeout(() => updateScrollPosition(), 300)
      }
    },
    [updateScrollPosition]
  )

  return (
    <div className="space-y-1.5 sm:space-y-3">
      {/* セクションタイトル */}
      <h2 className="text-sm sm:text-lg md:text-2xl lg:text-3xl font-bold px-3 sm:px-2 md:px-4 text-white flex items-center gap-1.5 sm:gap-2">
        <span className="text-blue-400 text-xs sm:text-base">▶</span> {section.title}
      </h2>
      {section.description && (
        <p className="text-xs sm:text-sm text-gray-400 px-3 sm:px-2 md:px-4 mb-2">
          {section.description}
        </p>
      )}

      <div className="relative group/scroll">
        {/* 左側グラデーションオーバーレイ */}
        {scrollPosition.canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-16 md:w-20 bg-gradient-to-r from-black via-black/50 to-transparent z-10 pointer-events-none" />
        )}

        {/* 左スクロールボタン */}
        <button
          onClick={() => scroll('left')}
          className={`absolute left-0 top-0 bottom-0 z-20 w-8 sm:w-10 md:w-16 bg-transparent flex items-center justify-center transition-all duration-300 ${
            scrollPosition.canScrollLeft
              ? 'opacity-60 sm:opacity-40 md:opacity-0 group-hover/scroll:opacity-100'
              : 'opacity-0 pointer-events-none'
          }`}
          aria-label="左にスクロール"
        >
          <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-110 shadow-lg border border-white/20">
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-8 md:h-8 text-white" />
          </div>
        </button>

        {/* 横スクロールコンテナ */}
        <div
          ref={scrollRef}
          className="flex gap-2 sm:gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-0 sm:px-10 md:px-16 py-1.5 sm:py-2 md:py-4 cursor-grab active:cursor-grabbing select-none"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            scrollPaddingLeft: '12px',
            scrollPaddingRight: '12px',
            willChange: 'scroll-position',
          }}
          tabIndex={0}
          role="region"
          aria-label={`${section.title}の記事テンプレート一覧`}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
        >
          {section.templates.map((template, index) => {
            const isFirst = index === 0
            const isLast = index === section.templates.length - 1

            return (
              <div
                key={template.id}
                className={`
                  ${isFirst ? 'ml-3 sm:ml-0' : ''}
                  ${isLast ? 'mr-3 sm:mr-0' : ''}
                `}
              >
                <ArticleCard
                  template={template}
                  isSelected={selectedTemplateId === template.id}
                  onClick={() => onSelectTemplate(template)}
                />
              </div>
            )
          })}
        </div>

        {/* 右側グラデーションオーバーレイ */}
        {scrollPosition.canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-16 md:w-20 bg-gradient-to-l from-black via-black/50 to-transparent z-10 pointer-events-none" />
        )}

        {/* 右スクロールボタン */}
        <button
          onClick={() => scroll('right')}
          className={`absolute right-0 top-0 bottom-0 z-20 w-8 sm:w-10 md:w-16 bg-transparent flex items-center justify-center transition-all duration-300 ${
            scrollPosition.canScrollRight
              ? 'opacity-60 sm:opacity-40 md:opacity-0 group-hover/scroll:opacity-100'
              : 'opacity-0 pointer-events-none'
          }`}
          aria-label="右にスクロール"
        >
          <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-110 shadow-lg border border-white/20">
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-8 md:h-8 text-white" />
          </div>
        </button>
      </div>
    </div>
  )
}
