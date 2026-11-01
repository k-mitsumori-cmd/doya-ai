'use client'

// ============================================
// ドヤポップアップ: 共通シェル（AppShell＋ToolFrame）に載せる枠
// ============================================
// ログインしているとき、layout.tsx から使う。
// ⚠️ ナビ（nav.ts）はサーバの layout.tsx から受け取る。アイコンは名前の文字列なので、そのまま渡せる。
// ⚠️ ページ本体と API は変えない。ページの見出しは ToolFrame が出すので、ページ側は小見出しにする（PopupShellContext）。
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import ToolFrame from '@/components/shell/ToolFrame'
import type { ShellNavItem } from '@/components/shell/nav'
import { PopupShellContext } from './shell-context'

// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここではツール内のナビ（ToolFrame）だけ
export default function PopupShellFrame({ nav, children, preview = false }: { nav: ShellNavItem[]; children: ReactNode; preview?: boolean }) {
  const pathname = usePathname()
  // 状態見本は自分で枠を選ぶ。親layoutの枠を外し、見本の内側だけpreviewを指定する。
  if (!preview && pathname?.startsWith('/popup/dev/')) return <>{children}</>
  return (
    <ToolFrame serviceId="popup" nav={nav}>
      <PopupShellContext.Provider value={true}>{children}</PopupShellContext.Provider>
    </ToolFrame>
  )
}
