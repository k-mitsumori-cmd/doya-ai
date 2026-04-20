import { Suspense } from 'react'
import { AnalyzingStage } from '@/components/allinone/AnalyzingStage'

export const dynamic = 'force-dynamic'

export default function AnalyzingPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[70vh] place-items-center bg-allinone-bg text-allinone-muted">
          初期化中…
        </div>
      }
    >
      <AnalyzingStage />
    </Suspense>
  )
}
