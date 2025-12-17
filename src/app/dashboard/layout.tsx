'use client'

import { Sidebar } from '@/components/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white lg:bg-gray-50">
      {/* サイドバー */}
      <Sidebar />
      
      {/* メインコンテンツ */}
      <div className="lg:ml-64">
        {/* モバイル用のヘッダースペーサー（ヘッダー高さ60px） */}
        <div className="h-[60px] lg:hidden" />
        
        <main>
          {children}
        </main>
      </div>
    </div>
  )
}
