// 開発用プレビューの枠。サーバーコンポーネントから AppShell と ToolFrame に nav を渡す見本。
// ⚠️ 各ツールの layout.tsx もこの形で書く。nav のアイコンは名前の文字列にする（部品を渡すと全画面が 500 になる）。
// ⚠️ 本番では 404。
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import ToolFrame from '@/components/shell/ToolFrame'
import type { ShellNavItem } from '@/components/shell/nav'
import { Button, Card } from '@/components/ds'

const NAV: ShellNavItem[] = [
  { label: '見積書', href: '/ds-preview', icon: 'FileText', exact: true },
  { label: '商品', href: '/ds-preview/products', icon: 'Receipt' },
  { label: '設定', href: '/ds-preview/settings', icon: 'Settings' },
  { label: '対応表に無い名前', href: '/ds-preview/unknown', icon: 'NoSuchIcon' },
]

export default function DsPreviewLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <AppShell userName="サンプル">
      <ToolFrame
        serviceId="quote"
        description="段0の見本です。各ツールはこの枠の中に既存のページをそのまま入れます。"
        action={<Button icon="Plus">見積書をつくる</Button>}
        nav={NAV}
        aside={<Card title="ヒント" icon="BookOpen"><p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--sub)' }}>右ペインは 1280px 以上でだけ表示されます。</p></Card>}
      >
        {children}
      </ToolFrame>
    </AppShell>
  )
}
