// ============================================
// 外部のポップアップ（HubSpot「その疑問、AIに聞いてみよう」）を出す画面の決まり
// ============================================
// 出す画面はここの1か所で決める（ServicePopupGuard が使う）。
// 出さない画面:
//   - 料金ページ（/pricing と /…/pricing）。プロのカードに重なるため
//   - ログインした人のツールの画面（共通の枠の中を含む）
//   - 共有の議事録（/m/）
//   - ログインの画面（/auth/ の下）。ログインの操作に重なり、中の文言も古い（2026-10-24 統括の確認）
// 出す画面: 紹介ページ（LP）など、未ログインの人が見る画面
import { shellServiceForPath } from '@/components/shell/registry'

export type PopupAuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

/** 料金ページか（/pricing、/<ツール>/pricing と、その下） */
export function isPricingPath(path: string): boolean {
  return /(^|\/)pricing(\/|$)/.test(path)
}

export function shouldHideMarketingPopup(opts: {
  pathname: string | null | undefined
  status: PopupAuthStatus
  /** ツールの URL の先頭の一覧（services.ts の href） */
  servicePaths: string[]
}): boolean {
  const path = opts.pathname?.replace(/\/+$/, '') || '/'
  if (path.startsWith('/m/')) return true
  if (path === '/auth' || path.startsWith('/auth/')) return true
  if (isPricingPath(path)) return true

  const service = opts.servicePaths.find((root) => path === root || path.startsWith(root + '/'))
  const inShellPath = shellServiceForPath(path) !== null
  if (!service && !inShellPath) return false

  // ログインした人の作業画面（枠の中）には出さない
  if (opts.status === 'authenticated') return true
  // 未ログインの紹介ページ（ツールの入口など）だけ出す。確認中は広告を一瞬出さないため隠す
  const publicMarketing = service !== undefined && (path === service || path === '/banner/landing' || path === '/banner/guide')
  if (opts.status === 'unauthenticated' && publicMarketing) return false
  return true
}
