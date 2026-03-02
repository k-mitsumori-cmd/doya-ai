'use client'

import { formatRemainingTime } from './useFreeHour'

export function SidebarFreeHourBanner({
  freeHourRemainingMs,
  isCollapsed,
  isMobile,
}: {
  freeHourRemainingMs: number
  isCollapsed: boolean
  isMobile?: boolean
}) {
  const showBanner = isMobile || !isCollapsed
  if (!showBanner || freeHourRemainingMs <= 0) return null

  return (
    <div className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-br from-amber-400 via-orange-400 to-red-400 border border-amber-300/50 relative overflow-hidden shadow-lg shadow-amber-500/20">
      <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 pointer-events-none" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
          <span className="text-xl">🚀</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white drop-shadow-sm">生成し放題中！</p>
          <p className="text-[10px] text-white/80 font-bold">全機能解放</p>
        </div>
        <div className="px-2.5 py-1.5 bg-white/30 rounded-lg backdrop-blur-sm flex-shrink-0">
          <p className="text-sm font-black text-white tabular-nums drop-shadow-sm">
            {formatRemainingTime(freeHourRemainingMs)}
          </p>
        </div>
      </div>
    </div>
  )
}
