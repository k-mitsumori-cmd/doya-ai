'use client'

import ErrorReportForm from '@/components/common/ErrorReportForm'

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
      <img src="/kintai/characters/error_%E6%B3%A3%E3%81%8D.png" alt="" style={{ width: 120, height: 120, objectFit: 'contain' }} />
      <h2 className="text-2xl font-black text-slate-800">画面を表示できませんでした</h2>
      <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-5 py-3 max-w-lg text-center">
        {/* 例外の文・digest は画面にも報告にも渡さない。 */}
        <p className="text-base font-bold text-red-700">一時的な不具合です。少し待って、もう一度お試しください。</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-6 py-3 bg-[#0066ff] text-white font-black rounded-full hover:bg-[#0047d6] transition-all shadow-lg text-base"
        >
          再試行する
        </button>
        <a
          href="/kintai"
          className="px-6 py-3 bg-white text-slate-700 font-bold rounded-full border-2 border-slate-200 hover:bg-slate-50 transition-all text-base"
        >
          トップへ戻る
        </a>
      </div>

      <ErrorReportForm errorType="500" />

    </div>
  )
}
