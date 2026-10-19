'use client'
import { useMemo } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { promaneNav } from '@/lib/promane/nav'
import { WorkspaceSwitcher } from '@/components/promane/workspace-switcher'
import { FeedbackButton } from '@/components/promane/feedback-button'
import { Toaster as SonnerToaster } from 'sonner'

// 共通の枠の中身。AppShell では包まない（枠は src/app/(shell)/layout.tsx が出す）
export default function PromaneShellFrame({ workspaceSlug, children }: { workspaceSlug: string; children: React.ReactNode }) {
  const nav = useMemo(() => promaneNav(workspaceSlug), [workspaceSlug])
  return (
    <ToolFrame serviceId="promane" nav={nav} switcher={<WorkspaceSwitcher />}>
      {children}
      {/* 全ページ常駐: フィードバック→Slack通知 */}
      <FeedbackButton variant="floating" />
      <SonnerToaster position="top-center" richColors closeButton toastOptions={{ style: { fontSize: '14px', fontWeight: 700, borderRadius: '16px' } }} />
    </ToolFrame>
  )
}
