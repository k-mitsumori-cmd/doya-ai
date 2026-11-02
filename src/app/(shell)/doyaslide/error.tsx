'use client'

import Link from 'next/link'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'
import { ErrorNotice } from '@/components/ds/feedback'
import ErrorReportForm from '@/components/common/ErrorReportForm'

export default function DoyaSlideError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // 新しい見た目では、全ツール共通のエラーの形（何が起きたか・どうすればよいか・やり直す）にする（UI 品質 S-20）
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-8">
      <ErrorNotice what="ページを表示できませんでした。" how="少し時間をおいて、もう一度お試しください。続くときはお問い合わせください。" onRetry={reset} retryLabel="もう一度読み込む" />
      <div className="flex flex-wrap gap-4 text-sm font-bold">
        <Link href="/doyaslide/projects" className="text-[#0066ff] hover:underline">プロジェクト一覧へ戻る</Link>
        <a href={SUPPORT_CONTACT_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:underline">お問い合わせ</a>
      </div>
      <ErrorReportForm errorType="500" />
    </div>
  )
}
