'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import CunningSidebar from '@/components/cunning/CunningSidebar'

export default function CunningLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [plan, setPlan] = useState<string>('FREE')

  useEffect(() => {
    if (session?.user) {
      fetch('/api/cunning/usage', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setPlan(d.plan || 'FREE'))
        .catch(() => {})
    }
  }, [session])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Toaster position="top-center" />

      <div className="hidden md:flex">
        <CunningSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={(collapsed) => setSidebarCollapsed(collapsed)}
          plan={plan}
        />
      </div>
      <div
        className="hidden md:block flex-shrink-0 transition-[width] duration-200"
        style={{ width: sidebarCollapsed ? 72 : 240 }}
        aria-hidden
      />

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-y-0 left-0 z-50 md:hidden"
          >
            <CunningSidebar forceExpanded isMobile onToggle={() => setMobileMenuOpen(false)} plan={plan} />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="md:hidden flex items-center gap-3 p-3 sm:p-4 border-b border-slate-200 bg-white">
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="メニューを開く"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-700"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/cunning/logo.png" alt="ドヤカンニング" className="h-8 w-auto object-contain" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}
