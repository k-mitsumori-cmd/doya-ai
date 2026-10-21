'use client'

import Link from 'next/link'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'
import { useUiNext } from '@/components/shell/ui-next-context'
import { Button, EmptyState } from '@/components/ds'

export default function DoyaSlideNotFound() {
  // 新しい見た目では、絵文字の代わりに共通の空状態の絵と、次にやること1つを出す（UI 品質 S-17）
  const uiNext = useUiNext()
  if (uiNext) {
    return (
      <div className="p-4 lg:p-8">
        <EmptyState kind="no-results" title="ページが見つかりません" description="お探しのページは、消えたか移動した可能性があります。" action={<Button href="/doyaslide/projects" variant="secondary">プロジェクト一覧へ</Button>} />
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
      <div className="text-5xl">🖼️</div>
      <h2 className="text-xl font-black text-slate-800">ページが見つかりません</h2>
      <p className="text-slate-500 text-center text-sm max-w-md font-medium">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Link
        href="/doyaslide/projects"
        className="px-6 py-2.5 bg-[#7f19e6] text-white font-bold rounded-xl hover:bg-[#6a14c2] transition-colors"
      >
        プロジェクト一覧へ
      </Link>
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
