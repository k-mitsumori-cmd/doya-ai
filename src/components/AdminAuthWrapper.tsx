'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'

const ALLOWED_DOMAIN = 'surisuta.jp'

export function AdminAuthWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status: googleStatus } = useSession()
  const [isAdminAuth, setIsAdminAuth] = useState<boolean | null>(null)

  const isLoginPage = pathname === '/admin/login'

  // Step 1: Admin password check
  useEffect(() => {
    if (isLoginPage) {
      setIsAdminAuth(true)
      return
    }

    const checkSession = async () => {
      try {
        const response = await fetch('/api/admin/auth/session', {
          credentials: 'include',
          cache: 'no-store',
        })
        if (response.ok) {
          const data = await response.json()
          setIsAdminAuth(data.authenticated === true)
          if (!data.authenticated) router.push('/admin/login')
        } else {
          setIsAdminAuth(false)
          router.push('/admin/login')
        }
      } catch {
        setIsAdminAuth(false)
        router.push('/admin/login')
      }
    }

    checkSession()
  }, [pathname, isLoginPage, router])

  if (isLoginPage) return <>{children}</>

  // Loading
  if (isAdminAuth === null || googleStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-violet-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-400">認証確認中...</p>
        </div>
      </div>
    )
  }

  // Admin password not authenticated
  if (!isAdminAuth) return null

  // Step 2: Google account check (@surisuta.jp only)
  const googleEmail = session?.user?.email
  const isDomainValid = googleEmail?.endsWith(`@${ALLOWED_DOMAIN}`)

  if (!googleEmail || !isDomainValid) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-10 max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto">
            <span className="text-3xl">🔒</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white mb-2">Google認証が必要です</h1>
            <p className="text-sm text-white/40">
              管理画面へのアクセスには<br />
              <span className="text-violet-400 font-bold">@{ALLOWED_DOMAIN}</span> のGoogleアカウントでのログインが必要です。
            </p>
          </div>
          {googleEmail && !isDomainValid && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-xs text-red-400">
                現在のアカウント: <span className="font-bold">{googleEmail}</span><br />
                このドメインではアクセスできません
              </p>
            </div>
          )}
          <button
            onClick={() => signIn('google', { callbackUrl: pathname })}
            className="w-full py-3 bg-white text-slate-800 font-bold rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Googleでログイン
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

