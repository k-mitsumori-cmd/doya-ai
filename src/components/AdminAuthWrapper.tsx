'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function AdminAuthWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  // ログインページの場合は認証チェックをスキップ
  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (isLoginPage) {
      setIsAuthenticated(true)
      return
    }

    // セッション確認
    const checkSession = async () => {
      try {
        const response = await fetch('/api/admin/auth/session', {
          credentials: 'include',
          cache: 'no-store',
        })

        if (response.ok) {
          const data = await response.json()
          if (data.authenticated) {
            setIsAuthenticated(true)
          } else {
            setIsAuthenticated(false)
            router.push('/admin/login')
          }
        } else {
          setIsAuthenticated(false)
          router.push('/admin/login')
        }
      } catch (error) {
        console.error('Session check error:', error)
        setIsAuthenticated(false)
        router.push('/admin/login')
      }
    }

    checkSession()
  }, [pathname, isLoginPage, router])

  // ログインページの場合はそのまま表示
  if (isLoginPage) {
    return <>{children}</>
  }

  // 認証確認中の場合はローディング表示
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-400">認証確認中...</p>
        </div>
      </div>
    )
  }

  // 認証されていない場合は何も表示しない（リダイレクト中）
  if (!isAuthenticated) {
    return null
  }

  // 認証済みの場合は子要素を表示
  return <>{children}</>
}

