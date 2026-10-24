'use client'
import ShellLoading from '@/components/shell/ShellLoading'

// 新しい見た目（チェックリスト §5.1）のときは、枠の中身の領域だけに骨組みを出す（UI 品質 C-3）。今の見た目では今までの黒い骨組み
export default function BannerDashboardLoading() {
  return <ShellLoading />
}

