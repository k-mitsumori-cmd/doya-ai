'use client'

import React from 'react'
import { Sidebar } from './Sidebar'
import { 
  Bell, 
  Settings, 
  Search, 
  User,
  Menu,
  X
} from 'lucide-react'
import { useSession } from 'next-auth/react'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Sidebar - Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-[#2563EB]">
            <Sidebar />
            <button 
              className="absolute top-4 right-[-3rem] p-2 text-white"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-40 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-gray-500 w-64 lg:w-96">
              <Search className="w-4 h-4" />
              <input 
                type="text" 
                placeholder="検索..." 
                className="bg-transparent border-none focus:ring-0 text-sm w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
              <Settings className="w-5 h-5" />
            </button>
            <div className="h-8 w-px bg-gray-200 mx-1 lg:mx-2" />
            <div className="flex items-center gap-3 pl-1">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-900">{session?.user?.name || '田中 太郎'}</p>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                  {session?.user?.email === 'admin@doya-ai.com' ? 'Admin' : 'Member'}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">
                <User className="w-5 h-5" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

