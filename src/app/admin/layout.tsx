'use client'

import { useState } from 'react'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminAuthWrapper } from '@/components/AdminAuthWrapper'
import { Menu, X, Shield } from 'lucide-react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <AdminAuthWrapper>
      <div className="flex min-h-screen bg-[#0a0a0f]">
        {/* Desktop Sidebar */}
        <AdminSidebar />

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
            <div className="relative w-64 h-full">
              <AdminSidebar isMobile />
              <button
                className="absolute top-3 right-[-2.5rem] p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-auto">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0D0D12]">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold text-white">Admin</span>
            </div>
          </div>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </AdminAuthWrapper>
  )
}
