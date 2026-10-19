'use client'
// ============================================
// 枠の中の読み込み（各ツールの loading.tsx から使う）
// ============================================
// 外枠・左のメニュー・ツールの見出しは消さず、中身の領域にだけ骨組みを出す（UI 品質 C-3）。
// ⚠️ 300ms 未満で終わる読み込みでは何も出さない（ds/Skeleton の遅延）。
// ⚠️ 新しい見た目（チェックリスト §5.1）でないときは何も出さない（今までは骨組みを出していなかった）。
import { Skeleton } from '@/components/ds'
import { useUiNext } from './ui-next-context'

export default function ShellLoading() {
  const uiNext = useUiNext()
  if (!uiNext) return null
  return (
    <div style={{ padding: 24, display: 'grid', gap: 16 }} aria-busy="true" aria-label="読み込み中">
      <Skeleton lines={1} height={28} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <Skeleton lines={3} height={18} />
        <Skeleton lines={3} height={18} />
        <Skeleton lines={3} height={18} />
      </div>
      <Skeleton lines={5} height={14} />
    </div>
  )
}
