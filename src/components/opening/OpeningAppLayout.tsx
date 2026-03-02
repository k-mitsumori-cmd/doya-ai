'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sparkles, Home, FolderOpen, CreditCard, BookOpen } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/opening', label: 'ホーム', icon: Home },
  { href: '/opening/dashboard', label: 'プロジェクト', icon: FolderOpen },
  { href: '/opening/pricing', label: '料金', icon: CreditCard },
  { href: '/opening/guide', label: 'ガイド', icon: BookOpen },
]

export default function OpeningAppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[#0A0505] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0505]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/opening" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EF4343] shadow-lg shadow-[#EF4343]/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">ドヤオープニングAI</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#EF4343]/80 font-semibold">Motion Generator</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/opening' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#EF4343]/10 text-[#EF4343]'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <Link
            href="/"
            className="text-sm text-white/40 hover:text-white transition-colors"
          >
            ドヤAIポータル
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="min-h-[calc(100vh-4rem)]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-white/30">
          © 2026 ドヤAI. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
