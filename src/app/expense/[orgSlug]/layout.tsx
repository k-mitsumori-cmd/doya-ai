'use client'

import { useEffect, useState } from 'react'
import { usePathname, useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Wallet } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import styles from '@/components/expense/tokens.module.css'
import ExpenseSidebar from '@/components/expense/ExpenseSidebar'
import { OrgContext, Loading, ErrorBox } from '@/components/expense/ui'
import type { Role } from '@/components/expense/types'

export default function ExpenseOrgLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()
  const orgSlug = (params.orgSlug as string) || ''
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [role, setRole] = useState<Role | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch(`/api/expense/usage?org=${encodeURIComponent(orgSlug)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/expense')
          return
        }
        const d = await r.json()
        if (!alive) return
        if (d?.role) {
          setRole(d.role as Role)
          setState('ok')
        } else setState('denied')
      })
      .catch(() => alive && setState('denied'))
    return () => {
      alive = false
    }
  }, [orgSlug, router])

  useEffect(() => setMobileOpen(false), [pathname])

  return (
    <div className={`${styles.root} flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]`}>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <div className="hidden md:flex">
        <ExpenseSidebar isCollapsed={collapsed} onToggle={(c) => setCollapsed(c)} orgSlug={orgSlug} role={role} />
      </div>
      <div className="hidden flex-shrink-0 transition-[width] duration-200 md:block" style={{ width: collapsed ? 72 : 240 }} aria-hidden />

      <AnimatePresence>
        {mobileOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="fixed inset-y-0 left-0 z-50 md:hidden">
            <ExpenseSidebar forceExpanded isMobile onToggle={() => setMobileOpen(false)} orgSlug={orgSlug} role={role} />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--paper)] p-3 md:hidden">
          <button onClick={() => setMobileOpen(true)} aria-label="メニューを開く" className="rounded-[var(--r-sm)] p-2 text-[var(--ink)] hover:bg-[var(--bg)]">
            <Menu className="h-6 w-6" />
          </button>
          <span className="grid h-7 w-7 place-items-center rounded-[var(--r-sm)] bg-[var(--blue)] text-white">
            <Wallet className="h-4 w-4" />
          </span>
          <span className="text-base font-black text-[var(--ink)]">ドヤ支出管理</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {state === 'loading' && <Loading />}
          {state === 'denied' && <ErrorBox forbidden />}
          {state === 'ok' && <OrgContext.Provider value={{ orgSlug, role }}>{children}</OrgContext.Provider>}
        </div>
      </main>
    </div>
  )
}
