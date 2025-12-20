'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Bell, 
  Mail, 
  Calendar, 
  MessageSquare, 
  CreditCard,
  BarChart3,
  Users,
  Sparkles,
  ChevronRight,
  HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

const sidebarItems = [
  { name: 'ダッシュボード', icon: LayoutDashboard, href: '/seo' },
  { name: 'お知らせ', icon: Bell, href: '/news' },
  { name: 'メール', icon: Mail, href: '/mail' },
  { name: 'カレンダー', icon: Calendar, href: '/calendar' },
  { name: 'AIチャット', icon: MessageSquare, href: '/chat' },
  { name: 'サービスプラン', icon: CreditCard, href: '/pricing' },
]

const databaseItems = [
  { name: 'アナリティクス', icon: BarChart3, href: '/analytics' },
  { name: '顧客情報', icon: Users, href: '/customers' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-[#2563EB] text-white flex flex-col z-50">
      {/* Brand */}
      <div className="p-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Bunridge</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-8 overflow-y-auto">
        <div>
          <ul className="space-y-1">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                      isActive 
                        ? "bg-white/15 text-white" 
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <item.icon className={cn(
                      "w-5 h-5",
                      isActive ? "text-white" : "text-white/60 group-hover:text-white"
                    )} />
                    <span className="font-medium text-sm">{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <h3 className="px-3 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">
            データベース
          </h3>
          <ul className="space-y-1">
            {databaseItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                      isActive 
                        ? "bg-white/15 text-white" 
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <item.icon className={cn(
                      "w-5 h-5",
                      isActive ? "text-white" : "text-white/60 group-hover:text-white"
                    )} />
                    <span className="font-medium text-sm">{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* Bottom Profile / Branding */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-3 rounded-lg bg-white/5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
            BG
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">@GORO</p>
          </div>
        </div>
      </div>
    </div>
  )
}

