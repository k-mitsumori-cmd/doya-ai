'use client'

// ============================================
// ドヤインタビューAI 共通の枠での表示（ToolFrame だけ）
// ============================================
// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここでは AppShell を使わない。
import { usePathname } from 'next/navigation'
import ToolFrame from '@/components/shell/ToolFrame'
import { useUiNext } from '@/components/shell/ui-next-context'
import { INTERVIEW_NAV } from '@/lib/interview/nav'

export default function InterviewShellFrame({ children }: { children: React.ReactNode }) {
  const uiNext = useUiNext()
  // 記事エディタは画面いっぱいに使うので、余白を付けない
  const padded = uiNext && !/\/edit\/?$/.test(usePathname() || '')
  return (
    <ToolFrame
      serviceId="interview"
      title="ドヤインタビューAI"
      description="取材の音声から、AIがインタビュー記事を作ります。"
      nav={INTERVIEW_NAV}
    >
      {/* 新しい見た目では、本文に左右の余白を付ける（今まで画面の端に貼り付いていた。旧レイアウトの余白と同じ値） */}
      {padded ? <div className="px-4 py-6 md:px-8 md:py-8"><div className="mx-auto max-w-7xl">{children}</div></div> : children}
    </ToolFrame>
  )
}
