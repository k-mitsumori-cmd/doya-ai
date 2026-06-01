'use client'

import { SUPPORT_CONTACT_URL } from '@/lib/pricing'

export default function DoyaSlideError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
      <div className="text-5xl">🖼️</div>
      <h2 className="text-xl font-black text-slate-800">エラーが発生しました</h2>
      <p className="text-slate-500 text-center text-sm max-w-md font-medium">
        ページの処理中にエラーが発生しました。<br />
        しばらくしてからもう一度お試しください。
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-[#7f19e6] text-white font-bold rounded-xl hover:bg-[#6a14c2] transition-colors"
        >
          再試行する
        </button>
        <a
          href="/doyaslide"
          className="px-6 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
        >
          トップへ戻る
        </a>
      </div>
      <a
        href={SUPPORT_CONTACT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium"
      >
        ご不明な点はお問い合わせください →
      </a>
    </div>
  )
}
