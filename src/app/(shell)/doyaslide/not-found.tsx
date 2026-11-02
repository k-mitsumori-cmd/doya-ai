'use client'

import { Button, EmptyState } from '@/components/ds'
import ErrorReportForm from '@/components/common/ErrorReportForm'

export default function DoyaSlideNotFound() {
  // 新しい見た目では、絵文字の代わりに共通の空状態の絵と、次にやること1つを出す（UI 品質 S-17）
  return (
    <div className="p-4 lg:p-8">
      <EmptyState kind="no-results" title="ページが見つかりません" description="お探しのページは、消えたか移動した可能性があります。" action={<Button href="/doyaslide/projects" variant="secondary">プロジェクト一覧へ</Button>} />
      <ErrorReportForm errorType="404" />
    </div>
  )
}
