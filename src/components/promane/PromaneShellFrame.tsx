'use client'
import { useMemo } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { promaneNav } from '@/lib/promane/nav'
import { WorkspaceSwitcher } from '@/components/promane/workspace-switcher'
import { FeedbackButton } from '@/components/promane/feedback-button'
import { Toaster as SonnerToaster } from 'sonner'
import { useNotice } from '@/components/notice/NoticeProvider'
import { SONNER_NOTICE_PROPS } from '@/components/notice/sonner-look'
import styles from './promane-next.module.css'

// 共通の枠の中身。AppShell では包まない（枠は src/app/(shell)/layout.tsx が出す）
export default function PromaneShellFrame({ workspaceSlug, children }: { workspaceSlug: string; children: React.ReactNode }) {
  const nav = useMemo(() => promaneNav(workspaceSlug), [workspaceSlug])
  const notice = useNotice()
  // 新しい見た目（UI 品質の直し）のときだけ、375px の余白の直しを効かせる（チェックリスト §5.1）
  return (
    <ToolFrame serviceId="promane" nav={nav} switcher={<WorkspaceSwitcher />}>
      <div className={styles.next}>{children}</div>
      {/* 全ページ常駐: フィードバック→Slack通知 */}
      <FeedbackButton variant="floating" />
      {/* ドヤくんの知らせの旗が出すと決めた人は、ほかのツールと同じ見た目・同じ場所（下のまん中）に出す（提案リスト (17)） */}
      {notice.enabled
        ? <SonnerToaster {...SONNER_NOTICE_PROPS} />
        : <SonnerToaster position="top-center" richColors closeButton toastOptions={{ style: { fontSize: '14px', fontWeight: 700, borderRadius: '16px' } }} />}
    </ToolFrame>
  )
}
