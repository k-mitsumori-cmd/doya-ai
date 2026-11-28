'use client'
import { createPortal } from 'react-dom'

/**
 * アプリ表示モード（ドヤバディの WebView）で、利用の上限に達したときに出す、中立のお知らせ。
 * 料金・プラン・契約・購入への案内、リンクは出さない（Apple の審査の決まり。docs/architecture/2026-11-18-app/app-mode-web.md）。
 */
export const APP_LIMIT_NOTICE_TEXT = '上限に達しました。'

export default function AppLimitNotice({ onClose }: { onClose: () => void }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
        <p className="text-base font-bold">{APP_LIMIT_NOTICE_TEXT}</p>
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold text-slate-700">
          閉じる
        </button>
      </div>
    </div>,
    document.body,
  )
}
