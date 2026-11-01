'use client'

// 共通シェルの中の外枠（ログインしていれば、いつもこれ。FRM-05）。ナビは nav.ts のデータを ToolFrame に渡すだけ（ADDON R-1）。
// ナビの icon は名前の文字列なので、サーバーから渡すこともできる。ここでは TenjikaiApp と同じクライアント部品の中で読んでいる。
import ToolFrame from '@/components/shell/ToolFrame'
import { TENJIKAI_NAV } from '@/lib/tenjikai/nav'
import TenjikaiApp from './TenjikaiApp'

// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここではツール内のナビ（ToolFrame）だけ
export default function TenjikaiShellFrame({ userId = null }: { userId?: string | null }) {
  return (
    <ToolFrame serviceId="tenjikai" nav={TENJIKAI_NAV}>
      <TenjikaiApp shell userId={userId} />
    </ToolFrame>
  )
}
