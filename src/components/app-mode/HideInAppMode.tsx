'use client'
import type { ReactNode } from 'react'
import { useAppMode } from '@/lib/app-mode/client'

/**
 * アプリ表示モード（ドヤバディの WebView）のときだけ、子を描画しない。料金・プラン・アップグレードへの入口を包む。
 * 旗オフ・アプリでないときは、子をそのまま描画する（見た目も動きも変わらない）。判定は useAppMode の1か所。
 */
export default function HideInAppMode({ children }: { children: ReactNode }) {
  const appMode = useAppMode()
  return appMode ? null : <>{children}</>
}
