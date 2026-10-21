'use client'

// 共通シェル（ui.shell.tenjikai が ON）のときの外枠。ナビは nav.ts のデータを ToolFrame に渡すだけ（ADDON R-1）。
// ナビの icon は名前の文字列なので、サーバーから渡すこともできる。ここでは TenjikaiApp と同じクライアント部品の中で読んでいる。
import ToolFrame from '@/components/shell/ToolFrame'
import { Suspense, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TENJIKAI_NAV } from '@/lib/tenjikai/nav'
import { sectionFromPath } from '@/lib/tenjikai/nav'
import { projectModeFromQuery, projectSectionHref } from '@/lib/tenjikai/project-detail-mode'
import { validOperationHandle, withGenerationOperation } from '@/lib/tenjikai/generation-status-client'
import { validSaveHandle, withSaveHandle } from '@/lib/tenjikai/workspace-save-client'
import TenjikaiApp from './TenjikaiApp'

// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここではツール内のナビ（ToolFrame）だけ
export default function TenjikaiShellFrame() {
  return <Suspense fallback={<p role="status" className="p-6">表示を確認しています。</p>}><TenjikaiShellFrameContent /></Suspense>
}

function TenjikaiShellFrameContent() {
  const query = useSearchParams()
  const mode = projectModeFromQuery(query)
  const handle = query.get('operation')
  const operationId = validOperationHandle(handle) ? handle : null
  const saveHandle = query.get('saveOperation')
  const saveOperationId = validSaveHandle(saveHandle) ? saveHandle : null
  const section = sectionFromPath(usePathname())
  const router = useRouter()
  const overviewHref = mode.kind === 'saved' ? withSaveHandle(withGenerationOperation(projectSectionHref('overview', mode), operationId), saveOperationId) : ''
  useEffect(() => {
    if (overviewHref && section === 'new') router.replace(overviewHref)
  }, [overviewHref, section, router])
  if (overviewHref && section === 'new') return <p role="status" className="p-6">保存内容を読み込んでいます。</p>
  const nav = TENJIKAI_NAV.map(item => ({ ...item,
    label: item.section === 'new' && saveOperationId ? '新規出展プロジェクト（保存確認後）' : item.label,
    href: item.section === 'new' && saveOperationId && mode.kind === 'saved'
      ? withSaveHandle(withGenerationOperation(projectSectionHref(section, mode), operationId), saveOperationId)
      : withSaveHandle(withGenerationOperation(mode.kind === 'new' ? item.href : projectSectionHref(item.section, mode), operationId), saveOperationId),
  }))
  return (
    <ToolFrame serviceId="tenjikai" title={mode.kind === 'new' ? undefined : '出展プロジェクト'} description={mode.kind === 'new' ? 'URLと出展条件から、ブース・制作物・ノベルティ・予算・業者・締切をまとめて用意します。' : '生成直後の作業内容はこのタブ内で保持します。再読み込み後は確認できる保存内容だけを表示します。'} nav={nav}>
      <TenjikaiApp shell />
    </ToolFrame>
  )
}
