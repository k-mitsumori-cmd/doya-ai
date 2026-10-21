'use client'

import Link from 'next/link'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'
import { useUiNext } from '@/components/shell/ui-next-context'
import { ErrorNotice } from '@/components/ds/feedback'

export default function DoyaSlideError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // 新しい見た目では、全ツール共通のエラーの形（何が起きたか・どうすればよいか・やり直す）にする（UI 品質 S-20）
  const uiNext = useUiNext()
  if (uiNext) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-8">
        <ErrorNotice what="ページを表示できませんでした。" how="少し時間をおいて、もう一度お試しください。続くときはお問い合わせください。" onRetry={reset} retryLabel="もう一度読み込む" />
        <div className="flex flex-wrap gap-4 text-sm font-bold">
          <Link href="/doyaslide/projects" className="text-[#0066ff] hover:underline">プロジェクト一覧へ戻る</Link>
          <a href={SUPPORT_CONTACT_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:underline">お問い合わせ</a>
        </div>
      </div>
    )
  }
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
        <Link
          href="/doyaslide/projects"
          className="px-6 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
        >
          プロジェクト一覧へ
        </Link>
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
