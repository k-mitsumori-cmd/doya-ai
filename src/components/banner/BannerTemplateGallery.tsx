'use client'

// ============================================
// ドヤバナーAI「見本から作る」の、見本の一覧の部品
// ============================================
// /banner/dashboard の絞り込みのボタンと見本のカードを、ここにまとめる。
// 白〜淡い青の背景と紺の文字で出す（旧来の黒い見た目は 2026-10-24 にやめた）。
// ⚠️ 見本の画像そのもの、画像の上に重ねる文字（題名・選択中・ロック）の色は変えない。
// ⚠️ 色を変えるのは背景・文字・枠線（ring は box-shadow）だけ。大きさ・余白は変えない（CLS を増やさない）。
import { motion } from 'framer-motion'
import { ChevronDown, ChevronRight, ImageIcon, Loader2, Lock } from 'lucide-react'

export type GalleryLockType = 'login' | 'pro' | 'enterprise' | null
export type GalleryPlanFilter = 'すべて' | 'FREE' | 'LIGHT' | 'PRO'

/** 一覧の部品のクラス */
export function galleryTheme() {
  return {
    filterBar: 'bg-[#f4f7fd] border-b border-[#e3e8f4]',
    backBar: 'border-b border-[#e3e8f4] bg-white/95 backdrop-blur-sm shadow-sm',
    backLabel: 'text-[#4a5375]',
    backButton: 'bg-white hover:bg-[#eaf1ff] border border-[#c6cde0] text-[#0a0f3c]',
    planRow: 'border-b border-[#e3e8f4]',
    planLabel: 'text-[#4a5375]',
    tabActive: 'bg-[#0a0f3c] text-white shadow-sm',
    tabInactive: 'bg-white text-[#4a5375] ring-1 ring-[#dbe3f3] hover:bg-[#eaf1ff] hover:text-[#0a0f3c]',
    planFreeInactive: 'bg-white text-emerald-700 ring-1 ring-[#dbe3f3] hover:bg-emerald-50 hover:text-emerald-800',
    planProInactive: 'bg-white text-amber-700 ring-1 ring-[#dbe3f3] hover:bg-amber-50 hover:text-amber-800',
    notice: 'bg-[#f4f7fd]',
    noticeText: 'text-[#0066ff]',
    noticeRetry: 'text-amber-700',
    grid: 'bg-[#f4f7fd]',
    heading: 'text-[#0a0f3c]',
    headingIcon: 'text-[#0066ff]',
    headingCount: 'text-[#4a5375]',
    headingSpinner: 'text-[#0066ff]/60',
    placeholder: 'bg-gradient-to-br from-[#eaf1ff] to-[#dfe8fb]',
    placeholderPending: 'bg-gradient-to-br from-[#eaf1ff] via-[#dfe8fb] to-[#eaf1ff]',
    placeholderIcon: 'text-[#8a93b0]',
    placeholderText: 'text-[#6b7493]',
    placeholderTrack: 'bg-[#c6cde0]',
    placeholderBar: 'bg-[#8a93b0]',
    pendingSpinner: 'text-[#0066ff]/60',
    skeletonLine: 'bg-[#dbe3f3]',
    ringPending: 'ring-1 ring-[#e3e8f4]',
    ringIdle: 'ring-1 ring-[#dbe3f3] hover:ring-[#0066ff]/50',
    ringSelected: 'ring-2 ring-[#0066ff] shadow-[0_0_12px_rgba(0,102,255,0.35)]',
    more: 'border-[#c6cde0] hover:border-[#0066ff] bg-white hover:bg-[#f0f5ff]',
    moreCircle: 'border-[#c6cde0] group-hover:border-[#0066ff]',
    moreText: 'text-[#4a5375] group-hover:text-[#0066ff]',
    moreTrack: 'bg-[#e3e8f4]',
    moreSpinner: 'text-[#0066ff]/60',
  }
}

/** プランの絞り込みのボタン（エンタープライズは統一プランで廃止した枠なので出さない） */
export function GalleryPlanTabs({ value, onChange }: {
  value: GalleryPlanFilter
  onChange: (v: GalleryPlanFilter) => void
}) {
  const t = galleryTheme()
  const tabs: { key: GalleryPlanFilter; label: string; color: string; inactive: string }[] = [
    { key: 'すべて', label: 'すべて', color: 'bg-[#0a0f3c] text-white', inactive: t.tabInactive },
    { key: 'FREE', label: 'ログイン(Free)', color: 'bg-emerald-500 text-white', inactive: t.planFreeInactive },
    { key: 'PRO', label: 'プロプラン(PRO)', color: 'bg-amber-500 text-white', inactive: t.planProInactive },
  ]
  return (
    <div className={`flex items-center gap-1 px-2 sm:px-4 md:px-8 lg:px-12 py-1.5 ${t.planRow} overflow-x-auto`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <span className={`flex-shrink-0 text-[10px] sm:text-xs ${t.planLabel} mr-1`}>プラン:</span>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          aria-pressed={value === tab.key}
          className={`flex-shrink-0 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${
            value === tab.key ? tab.color + (' shadow-sm') : tab.inactive
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/** ジャンルの絞り込みのボタン */
export function GalleryGenreTabs({ tabs, value, onChange }: {
  tabs: string[]
  value: string
  onChange: (v: string) => void
}) {
  const t = galleryTheme()
  return (
    <div data-tour="filter-tabs" className="flex items-center gap-1 px-2 sm:px-4 md:px-8 lg:px-12 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          aria-pressed={value === tab}
          className={`flex-shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
            value === tab ? t.tabActive : t.tabInactive
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

/** カテゴリの見出し */
export function GalleryCategoryHeading({ name, count, loading }: { name: string; count: number; loading: boolean }) {
  const t = galleryTheme()
  return (
    <h3 className={`text-xs sm:text-sm font-bold ${t.heading} px-1 sm:px-2 py-1.5 flex items-center gap-1.5`}>
      <ChevronRight className={`h-4 w-4 ${t.headingIcon}`} /> {name}
      <span className={`${t.headingCount} text-[10px]`}>({count})</span>
      {loading && <Loader2 className={`w-3 h-3 animate-spin ${t.headingSpinner} ml-1`} />}
    </h3>
  )
}

/** 読み込み中の見本の一覧（3段×4枚） */
export function GallerySkeleton() {
  const t = galleryTheme()
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((section) => (
        <div key={section}>
          <div className="flex items-center gap-1.5 px-1 sm:px-2 py-1.5">
            <ChevronRight className={`h-3 w-3 ${t.headingIcon}`} />
            <div className={`h-3.5 w-24 ${t.skeletonLine} rounded animate-pulse`} style={{ animationDelay: `${section * 150}ms` }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`aspect-[1200/628] rounded ${t.placeholder} overflow-hidden relative flex flex-col items-center justify-center gap-1.5`}>
                <Loader2 className={`w-5 h-5 animate-spin ${t.placeholderIcon}`} />
                <div className={`w-12 h-0.5 ${t.placeholderTrack} rounded-full overflow-hidden`}>
                  <div className={`h-full ${t.placeholderBar} rounded-full animate-[progressGrow_4s_ease-out_forwards]`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export type GalleryCardTemplate = {
  id: string
  industry: string
  imageUrl: string | null
  displayTitle?: string
  name?: string
  isPending?: boolean
}

/** 見本のカード1枚 */
export function GalleryTemplateCard({
  template, src, srcSet, imgKey, isLoaded, hasError, failed, selected, lockType, eager, loadingBar, cardRef, onClick, onLoad, onError,
}: {
  template: GalleryCardTemplate
  src: string
  srcSet: string
  imgKey: string
  isLoaded: boolean
  hasError: boolean
  /** 読み込みのやり直しを使い切った */
  failed: boolean
  selected: boolean
  lockType: GalleryLockType
  eager: boolean
  /** 読み込み中に細い進み具合の線を出す（カテゴリ別の一覧だけ。今までの見た目に合わせる） */
  loadingBar: boolean
  cardRef?: (el: HTMLDivElement | null) => void
  onClick: () => void
  onLoad: () => void
  onError: () => void
}) {
  const t = galleryTheme()
  const showImage = Boolean(template.imageUrl) && !hasError && !template.isPending
  const isLocked = lockType !== null
  return (
    <motion.div
      ref={cardRef}
      whileHover={{ scale: 1.04, zIndex: 10 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`group relative aspect-[1200/628] rounded overflow-hidden ${
        template.isPending
          ? `cursor-default ${t.ringPending} opacity-60`
          : isLocked
            ? 'cursor-pointer opacity-70 hover:opacity-90'
            : selected
              ? `cursor-pointer ${t.ringSelected}`
              : `cursor-pointer ${t.ringIdle}`
      }`}
    >
      {template.isPending ? (
        <div className={`w-full h-full ${t.placeholderPending} flex items-center justify-center`}>
          <div className="text-center">
            <Loader2 className={`w-5 h-5 animate-spin ${t.pendingSpinner} mx-auto mb-1.5`} />
            <p className={`text-[9px] ${t.placeholderText} font-medium`}>画像読み込み中</p>
          </div>
        </div>
      ) : showImage ? (
        <>
          {!isLoaded && (
            loadingBar ? (
              <div className={`absolute inset-0 ${t.placeholder} flex flex-col items-center justify-center gap-1.5`}>
                <Loader2 className={`w-4 h-4 animate-spin ${t.placeholderIcon}`} />
                <div className={`w-10 h-0.5 ${t.placeholderTrack} rounded-full overflow-hidden`}>
                  <div className={`h-full ${t.placeholderBar} rounded-full animate-[progressGrow_4s_ease-out_forwards]`} />
                </div>
              </div>
            ) : (
              <div className={`absolute inset-0 ${t.placeholder} flex items-center justify-center`}>
                <Loader2 className={`w-4 h-4 animate-spin ${t.placeholderIcon}`} />
              </div>
            )
          )}
          <img
            key={imgKey}
            src={src}
            srcSet={srcSet}
            alt={template.displayTitle || template.industry}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={eager ? 'high' : 'auto'}
            onLoad={onLoad}
            onError={onError}
            className={`w-full h-full object-cover transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      ) : hasError && failed ? (
        <div className={`w-full h-full ${t.placeholder} flex items-center justify-center`}>
          <div className="text-center">
            <ImageIcon className={`w-4 h-4 ${t.placeholderIcon} mx-auto mb-1`} />
            <p className={`text-[8px] ${t.placeholderText}`}>読み込み失敗</p>
          </div>
        </div>
      ) : (
        <div className={`w-full h-full ${t.placeholder} flex items-center justify-center`}>
          <Loader2 className={`w-4 h-4 animate-spin ${t.placeholderIcon}`} />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1 sm:p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[7px] sm:text-[9px] font-bold text-white line-clamp-1 drop-shadow">
          {template.displayTitle || template.name || template.industry}
        </p>
      </div>
      {selected && !isLocked && (
        <div className="absolute top-1 left-1 bg-blue-500 px-1.5 py-0.5 rounded text-[7px] sm:text-[8px] font-bold text-white shadow z-20">
          選択中
        </div>
      )}
      {isLocked && (
        <>
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
          <div className={`absolute top-1 right-1 flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold text-white z-20 ${
            lockType === 'enterprise' ? 'bg-brand-400/90' : lockType === 'login' ? 'bg-red-500/90' : 'bg-amber-500/90'
          }`}>
            <Lock className="w-2 h-2" />
            {lockType === 'enterprise' ? '法人プラン' : lockType === 'login' ? 'ログイン' : 'PRO'}
          </div>
        </>
      )}
    </motion.div>
  )
}

/** 一覧の末尾の「もっと見る」タイル */
export function GalleryMoreTile({ fetching, progress, hiddenCount, onClick }: {
  /** 残りを取得中で、まだ出せる見本が無い */
  fetching: boolean
  progress: number
  hiddenCount: number
  onClick: () => void
}) {
  const t = galleryTheme()
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative aspect-[1200/628] rounded overflow-hidden cursor-pointer border-2 border-dashed ${t.more} transition-all flex items-center justify-center`}
    >
      {fetching ? (
        <div className="text-center w-full px-3 sm:px-4">
          <Loader2 className={`w-5 h-5 sm:w-6 sm:h-6 animate-spin ${t.moreSpinner} mx-auto mb-2`} />
          <div className={`w-full ${t.moreTrack} rounded-full h-1.5 sm:h-2 overflow-hidden mb-1.5`}>
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[9px] sm:text-[10px] text-[#4a5375] font-medium">{progress}% 読み込み中</p>
        </div>
      ) : (
        <div className="text-center">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-dashed ${t.moreCircle} flex items-center justify-center mx-auto mb-2 transition-colors`}>
            <ChevronDown className={`w-5 h-5 sm:w-6 sm:h-6 ${t.moreText} transition-colors`} />
          </div>
          <p className={`text-[10px] sm:text-xs ${t.moreText} font-medium transition-colors`}>もっと見る{hiddenCount > 0 ? ` (+${hiddenCount})` : ''}</p>
        </div>
      )}
    </button>
  )
}
