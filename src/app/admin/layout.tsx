'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminAuthWrapper } from '@/components/AdminAuthWrapper'
import { Menu, X, Shield } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/admin/login'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)
  const closerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => { setIsSidebarOpen(false) }, [pathname])

  useEffect(() => {
    if (!isSidebarOpen || isLoginPage) return
    const desktop = window.matchMedia('(min-width: 768px)')
    if (desktop.matches) { setIsSidebarOpen(false); return }
    const dialog = dialogRef.current
    if (!dialog) return
    const opener = openerRef.current
    const content = contentRef.current
    const main = mainRef.current
    const previousOverflow = document.body.style.overflow
    const previousInert = content?.inert ?? false
    document.body.style.overflow = 'hidden'
    if (content) content.inert = true
    closerRef.current?.focus()

    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setIsSidebarOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0 && window.getComputedStyle(element).visibility !== 'hidden')
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) { event.preventDefault(); dialog.focus(); return }
      const outside = !dialog.contains(document.activeElement)
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault(); first.focus()
      }
    }
    const resized = (event: MediaQueryListEvent) => { if (event.matches) setIsSidebarOpen(false) }
    document.addEventListener('keydown', keydown)
    desktop.addEventListener('change', resized)
    return () => {
      document.removeEventListener('keydown', keydown)
      desktop.removeEventListener('change', resized)
      document.body.style.overflow = previousOverflow
      if (content) content.inert = previousInert
      if (opener?.isConnected && opener.getClientRects().length > 0) opener.focus()
      else if (main?.isConnected) main.focus()
    }
  }, [isSidebarOpen, isLoginPage])

  if (isLoginPage) {
    return <AdminAuthWrapper><main className="min-h-screen bg-[#0a0a0f]">{children}</main></AdminAuthWrapper>
  }

  return (
    <AdminAuthWrapper>
      <div className="flex min-h-screen bg-[#0a0a0f]">
        <AdminSidebar />
        {isSidebarOpen && (
          <div id="admin-mobile-navigation" ref={dialogRef} role="dialog" aria-modal="true" aria-label="管理メニュー" tabIndex={-1}
            className="fixed inset-0 z-50 md:hidden"
            onClickCapture={event => {
              if (event.target instanceof Element && event.target.closest('a[href]')) setIsSidebarOpen(false)
            }}>
            <div aria-hidden="true" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
            <div className="relative w-64 h-full">
              <AdminSidebar isMobile />
              <button ref={closerRef} type="button" aria-label="管理メニューを閉じる"
                className="absolute top-3 right-[-2.5rem] inline-flex min-h-11 min-w-11 items-center justify-center p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={() => setIsSidebarOpen(false)}>
                <X aria-hidden="true" className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        <div ref={contentRef} aria-hidden={isSidebarOpen ? true : undefined} className="flex-1 flex flex-col overflow-auto">
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0D0D12]">
            <button ref={openerRef} type="button" aria-label="管理メニューを開く" aria-expanded={isSidebarOpen}
              aria-controls={isSidebarOpen ? 'admin-mobile-navigation' : undefined}
              onClick={() => setIsSidebarOpen(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <Menu aria-hidden="true" className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold text-white">Admin</span>
            </div>
          </div>
          <main ref={mainRef} tabIndex={-1} className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </AdminAuthWrapper>
  )
}
