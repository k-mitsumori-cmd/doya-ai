'use client'

import { useState } from 'react'

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [showReport, setShowReport] = useState(false)
  const [reportText, setReportText] = useState('')
  const [sent, setSent] = useState(false)

  async function handleReport() {
    if (!reportText.trim()) return
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'kintai',
          type: 'error',
          page: '/kintai/dashboard',
          error: `${error.message} (digest: ${error.digest || 'none'})`,
          description: reportText.trim(),
        }),
      })
      setSent(true)
    } catch {}
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
      <img src="/kintai/characters/error_泣き.png" alt="エラー" style={{ width: 120, height: 120, objectFit: 'contain' }} />
      <h2 className="text-2xl font-black text-slate-800">エラーが発生しました</h2>
      <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-5 py-3 max-w-lg text-center">
        <p className="text-base font-bold text-red-700">{error.message}</p>
        {error.digest && <p className="text-xs text-red-400 mt-1">digest: {error.digest}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-6 py-3 bg-[#7f19e6] text-white font-black rounded-full hover:bg-[#6a14c2] transition-all shadow-lg text-base"
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

      {!showReport && !sent && (
        <button onClick={() => setShowReport(true)} className="mt-2 text-sm font-bold text-[#7f19e6] hover:underline">
          🐛 エラーを報告する
        </button>
      )}

      {showReport && !sent && (
        <div className="mt-3 w-full max-w-md bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-lg">
          <p className="text-base font-black text-slate-800 mb-2">エラー報告</p>
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="どんな操作でエラーが出ましたか？"
            rows={3}
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-medium focus:border-[#7f19e6] outline-none resize-none"
          />
          <button
            onClick={handleReport}
            disabled={!reportText.trim()}
            className="mt-2 w-full px-6 py-3 bg-gradient-to-r from-[#7f19e6] to-[#5b0fb3] text-white font-black rounded-full disabled:opacity-50 text-sm"
          >
            報告を送信
          </button>
        </div>
      )}

      {sent && (
        <div className="mt-3 bg-green-50 border-2 border-green-200 rounded-2xl px-6 py-4 text-center">
          <p className="text-base font-black text-green-700">ありがとうございます！</p>
        </div>
      )}
    </div>
  )
}
