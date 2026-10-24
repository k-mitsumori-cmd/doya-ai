'use client'

// 共通シェルの中の外枠（ログインしていれば、UI_SHELL_SERVICES に関係なくいつもこれ。FRM-05）。ナビは nav.ts のデータを ToolFrame に渡すだけ（ADDON R-1）。
// ナビの icon は名前の文字列なので、サーバーから渡すこともできる。ここでは TenjikaiApp と同じクライアント部品の中で読んでいる。
import ToolFrame from '@/components/shell/ToolFrame'
import { TENJIKAI_NAV } from '@/lib/tenjikai/nav'
import TenjikaiApp from './TenjikaiApp'

// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここではツール内のナビ（ToolFrame）だけ
export default function TenjikaiShellFrame({ userId = null }: { userId?: string | null }) {
  return (
    <ToolFrame serviceId="tenjikai" description="URLと出展条件から、ブース・制作物・ノベルティ・予算・業者・締切をまとめて用意します。" nav={TENJIKAI_NAV}>
      <TenjikaiApp shell userId={userId} />
    </ToolFrame>
  )
}
