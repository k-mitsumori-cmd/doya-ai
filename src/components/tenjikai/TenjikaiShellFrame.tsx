'use client'

// 共通シェル（ui.shell.tenjikai が ON）のときの外枠。ナビは nav.ts のデータを ToolFrame に渡すだけ（ADDON R-1）。
// ナビの icon は名前の文字列なので、サーバーから渡すこともできる。ここでは TenjikaiApp と同じクライアント部品の中で読んでいる。
import AppShell from '@/components/shell/AppShell'
import ToolFrame from '@/components/shell/ToolFrame'
import { TENJIKAI_NAV } from '@/lib/tenjikai/nav'
import TenjikaiApp from './TenjikaiApp'

export default function TenjikaiShellFrame({ userName }: { userName?: string | null }) {
  return (
    <AppShell userName={userName}>
      <ToolFrame serviceId="tenjikai" description="URLと出展条件から、ブース・制作物・ノベルティ・予算・業者・締切をまとめて用意します。" nav={TENJIKAI_NAV}>
        <TenjikaiApp shell />
      </ToolFrame>
    </AppShell>
  )
}
