'use client'

import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminAuthWrapper } from '@/components/AdminAuthWrapper'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 管理画面はサイドバー付きで表示
  // AdminAuthWrapperが認証チェックとログインページ判定を行う
  return (
    <AdminAuthWrapper>
      <div className="flex min-h-screen bg-[#0a0a0f]">
        <AdminSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </AdminAuthWrapper>
  )
}
