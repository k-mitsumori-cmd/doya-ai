'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import InterviewXSidebar from './InterviewXSidebar'

export default function InterviewXLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()

  // 公開回答ページではサイドバーを非表示
  const isPublicPage = pathname?.includes('/interviewx/respond/')

  if (isPublicPage) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-[#f5f7fb]">
      <div className="hidden md:block">
        <InterviewXSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={(v) => setSidebarCollapsed(v)}
        />
      </div>
      <div
        className="hidden md:block flex-shrink-0 transition-all duration-200"
        style={{ width: sidebarCollapsed ? 72 : 240 }}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
