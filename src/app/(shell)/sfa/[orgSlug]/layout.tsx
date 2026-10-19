'use client'

import { Fragment, useEffect, useState } from 'react'
import { usePathname, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, TrendingUp } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import SfaSidebar from '@/components/sfa/SfaSidebar'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { sfaJson } from '@/lib/sfa/client-response'
import { useSfaShell } from '@/lib/sfa/shell-context'

interface Membership { slug: string; name: string; role: string }

export default function SfaOrgLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useParams()
  const orgSlug = (params.orgSlug as string) || ''
  const guard = useOrgSettingsGuard(orgSlug)
  // 共通の枠（SfaShellFrame）の中のとき、サイドバーと外枠は描かない（枠と ToolFrame が出す）。所属組織の一覧だけ枠へ渡す
  const shell = useSfaShell()
  const [usageKey, setUsageKey] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [plan, setPlan] = useState<string | undefined>()
  const [memberships, setMemberships] = useState<Membership[]>([])

  useEffect(() => {
    if (!guard.allowed) return
    const operation = guard.begin('usage')
    if (!operation) return
    setPlan(undefined); setMemberships([]); setUsageKey('')
    sfaJson('/api/sfa/usage', orgSlug, { signal: operation.signal }).then(d => {
      if (!operation.current()) return
      if (typeof d.plan !== 'string' || !Array.isArray(d.memberships) || !d.memberships.every(m => m && typeof m === 'object' && typeof m.slug === 'string' && typeof m.name === 'string' && typeof m.role === 'string')) throw new Error()
      setPlan(d.plan); setMemberships(d.memberships as Membership[]); setUsageKey(guard.key)
    }).catch(() => { if (operation.current()) { setPlan(undefined); setMemberships([]) } }).finally(operation.end)
    return operation.end
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard.key, guard.allowed, orgSlug])
  const currentPlan = guard.allowed && usageKey === guard.key ? plan : undefined
  const currentMemberships = guard.allowed && usageKey === guard.key ? memberships : []

  const membershipsKey = JSON.stringify(currentMemberships)
  useEffect(() => {
    if (!shell) return
    shell.publishMemberships(currentMemberships)
    return () => shell.publishMemberships([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell, membershipsKey])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // ログイン状態の確認が終わらないとき、読み込み中のまま止まらないよう案内を出す
  const [guardStalled, setGuardStalled] = useState(false)
  useEffect(() => {
    setGuardStalled(false)
    if (guard.allowed || guard.requiresLogin) return
    const timer = setTimeout(() => setGuardStalled(true), 15000)
    return () => clearTimeout(timer)
  }, [guard.allowed, guard.requiresLogin, guard.key])

  const guardView = (
    <>
    {!guard.allowed && (guardStalled && !guard.requiresLogin ? (
      <div role="alert" className="p-6 space-y-3">
        <p>ログイン状態を確認できませんでした。通信状況を確認して、ページを再読み込みしてください。</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold">再読み込み</button>
      </div>
    ) : <p role="status" className="p-6">{guard.requiresLogin ? '再度ログインしてください。' : 'ログイン状態を確認しています。'}</p>)}
    <div hidden={!guard.allowed}><Fragment key={guard.identity}>{children}</Fragment></div>
    </>
  )

  if (shell) {
    return (
      <>
        <Toaster position="top-center" />
        {guardView}
      </>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Toaster position="top-center" />
      <div className="hidden md:flex">
        <SfaSidebar isCollapsed={sidebarCollapsed} onToggle={(c) => setSidebarCollapsed(c)} plan={currentPlan} orgSlug={orgSlug} memberships={currentMemberships} />
      </div>
      <div className="hidden md:block flex-shrink-0 transition-[width] duration-200" style={{ width: sidebarCollapsed ? 72 : 240 }} aria-hidden />

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="fixed inset-y-0 left-0 z-50 md:hidden">
            <SfaSidebar forceExpanded isMobile onToggle={() => setMobileMenuOpen(false)} plan={currentPlan} orgSlug={orgSlug} memberships={currentMemberships} />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="md:hidden flex items-center gap-3 p-3 sm:p-4 border-b border-slate-200 bg-white">
          <button onClick={() => setMobileMenuOpen(true)} aria-label="メニューを開く" className="p-2 rounded-lg hover:bg-slate-100 text-slate-700">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span className="text-base sm:text-lg font-bold text-slate-900 whitespace-nowrap">ドヤ営業管理</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {guardView}
        </div>
      </main>
    </div>
  )
}
