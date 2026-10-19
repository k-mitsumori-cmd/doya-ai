'use client'

// ============================================
// ドヤインタビューAI 共通の枠での表示（ToolFrame だけ）
// ============================================
// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここでは AppShell を使わない。
import ToolFrame from '@/components/shell/ToolFrame'
import { INTERVIEW_NAV } from '@/lib/interview/nav'

export default function InterviewShellFrame({ children }: { children: React.ReactNode }) {
  return (
    <ToolFrame
      serviceId="interview"
      title="ドヤインタビューAI"
      description="取材の音声から、AIがインタビュー記事を作ります。"
      nav={INTERVIEW_NAV}
    >
      {children}
    </ToolFrame>
  )
}
