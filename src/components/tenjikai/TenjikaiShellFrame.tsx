'use client'

// 共通シェル（ui.shell.tenjikai が ON）のときの外枠。ナビは nav.ts のデータを ToolFrame に渡すだけ（ADDON R-1）。
// ナビの icon は名前の文字列なので、サーバーから渡すこともできる。ここでは TenjikaiApp と同じクライアント部品の中で読んでいる。
import ToolFrame from '@/components/shell/ToolFrame'
import { Suspense, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TENJIKAI_NAV } from '@/lib/tenjikai/nav'
import { sectionFromPath } from '@/lib/tenjikai/nav'
import { projectModeFromQuery, projectSectionHref } from '@/lib/tenjikai/project-detail-mode'
import TenjikaiApp from './TenjikaiApp'

// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここではツール内のナビ（ToolFrame）だけ
export default function TenjikaiShellFrame() {
  return <Suspense fallback={<p role="status" className="p-6">表示を確認しています。</p>}><TenjikaiShellFrameContent /></Suspense>
}

function TenjikaiShellFrameContent() {
  const mode = projectModeFromQuery(useSearchParams())
  const section = sectionFromPath(usePathname())
  const router = useRouter()
  const overviewHref = mode.kind === 'saved' ? projectSectionHref('overview', mode) : ''
  useEffect(() => {
    if (overviewHref && section === 'new') router.replace(overviewHref)
  }, [overviewHref, section, router])
  if (overviewHref && section === 'new') return <p role="status" className="p-6">保存内容を読み込んでいます。</p>
  const nav = mode.kind === 'new' ? TENJIKAI_NAV : TENJIKAI_NAV.map(item => ({ ...item, href: projectSectionHref(item.section, mode) }))
  return (
    <ToolFrame serviceId="tenjikai" title={mode.kind === 'new' ? undefined : '保存内容の確認'} description={mode.kind === 'new' ? 'URLと出展条件から、ブース・制作物・ノベルティ・予算・業者・締切をまとめて用意します。' : '保存されている入力内容と分析結果を表示しています。この画面では編集・保存はできません。'} nav={nav}>
      <TenjikaiApp shell />
    </ToolFrame>
  )
}
