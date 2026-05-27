'use client'

export default function KintaiError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
      <img
        src="/kintai/characters/error_泣き.png"
        alt="エラー"
        style={{ width: 120, height: 120, objectFit: 'contain' }}
      />
      <h2 className="text-xl font-bold text-slate-800">エラーが発生しました</h2>
      <p className="text-slate-500 text-center text-sm max-w-md">
        ページの読み込み中にエラーが発生しました。<br />
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
          href="/kintai"
          className="px-6 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
        >
          トップへ戻る
        </a>
      </div>
    </div>
  )
}
