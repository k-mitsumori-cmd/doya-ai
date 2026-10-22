'use client'

// ============================================
// ドヤ営業管理: 一覧が空のときの表示
// ============================================
// 新しい見た目（UI 品質 §5.1・S-17）のときは、空状態の絵・説明・次の操作を1つ出す（ds の EmptyState）。
// ⚠️ 新しい見た目でないときは、今までの表示（legacy）をそのまま出す。
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/ds'
import { useUiNext } from '@/components/shell/ui-next-context'

export default function SfaEmpty({ title, description, action, filtered, bare, legacy }: {
  title: string
  description?: ReactNode
  /** 次にやることは1つだけ */
  action?: ReactNode
  /** 絞り込みの結果が0件のとき（作るのではなく条件を変える案内なので、絵を「見つからない」にする） */
  filtered?: boolean
  /** カード（ds の Card など）の中に置くとき。外側の枠を付けない */
  bare?: boolean
  legacy: ReactNode
}) {
  const uiNext = useUiNext()
  if (!uiNext) return <>{legacy}</>
  return (
    <div className={bare ? undefined : 'rounded-2xl border border-slate-200 bg-white'}>
      <EmptyState
        kind={filtered ? 'no-results' : 'zero'}
        title={title}
        description={description}
        action={action}
        art={filtered ? undefined : '/sfa/empty-deals.webp'}
      />
    </div>
  )
}
