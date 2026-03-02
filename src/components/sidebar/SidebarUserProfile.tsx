'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, LogIn, User } from 'lucide-react'
import type { Session } from 'next-auth'
import type { SidebarTheme } from './types'

export function SidebarUserProfile({
  session,
  isLoggedIn,
  showLabel,
  isCollapsed,
  isMobile,
  theme,
  settingsHref,
  loginCallbackUrl,
  onLogout,
  renderExtra,
}: {
  session: Session | null
  isLoggedIn: boolean
  showLabel: boolean
  isCollapsed: boolean
  isMobile?: boolean
  theme: SidebarTheme
  settingsHref?: string
  loginCallbackUrl: string
  onLogout: () => void
  renderExtra?: () => React.ReactNode
}) {
  const profileContent = (
    <>
      <div className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full ${theme.avatarBg} flex items-center justify-center flex-shrink-0 shadow-inner border border-white/10`}>
        {session?.user?.image ? (
          <img
            src={session.user.image}
            alt={session.user.name || 'User'}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <User className="w-4 h-4 text-white" />
        )}
      </div>
      <AnimatePresence>
        {showLabel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-w-0"
          >
            <p className="text-sm sm:text-xs font-bold text-white truncate">
              {session?.user?.name || (isLoggedIn ? 'ユーザー' : 'ゲスト')}
            </p>
            {renderExtra?.()}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )

  return (
    <div className={`p-2 sm:p-3 border-t border-white/5 ${theme.profileBg}`}>
      <div className={`flex items-center gap-2 ${!isMobile && isCollapsed ? 'justify-center' : ''}`}>
        {settingsHref ? (
          <Link
            href={settingsHref}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-1 min-w-0"
          >
            {profileContent}
          </Link>
        ) : (
          <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-1 min-w-0">
            {profileContent}
          </div>
        )}
        {showLabel && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {isLoggedIn ? (
              <button
                onClick={onLogout}
                className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="ログアウト"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <Link
                href={`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent(loginCallbackUrl)}`}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white ${theme.loginText} text-[10px] font-black ${theme.loginHover} transition-colors shadow-sm`}
              >
                <LogIn className="w-3.5 h-3.5" />
                ログイン
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
