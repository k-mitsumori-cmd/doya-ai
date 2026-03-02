import { cookies } from 'next/headers'
import { verifyAdminSession } from './admin-auth'
import { redirect } from 'next/navigation'

const COOKIE_NAME = 'admin_session_token'

/**
 * 管理者認証チェック（サーバーサイド）
 * 認証されていない場合はログインページにリダイレクト
 */
export async function requireAdminAuth(): Promise<{
  adminUser: { id: string; username: string; email: string | null; name: string | null }
}> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) {
    redirect('/admin/login')
  }

  const session = await verifyAdminSession(token)

  if (!session.valid || !session.adminUser) {
    redirect('/admin/login')
  }

  return { adminUser: session.adminUser }
}

/**
 * 管理者認証チェック（クライアントサイド用）
 * APIからセッション情報を取得
 */
export async function getAdminSession(): Promise<{
  authenticated: boolean
  adminUser?: { id: string; username: string; email: string | null; name: string | null }
}> {
  try {
    const response = await fetch('/api/admin/auth/session', {
      credentials: 'include',
      cache: 'no-store',
    })

    if (!response.ok) {
      return { authenticated: false }
    }

    const data = await response.json()
    return {
      authenticated: data.authenticated,
      adminUser: data.adminUser,
    }
  } catch (error) {
    console.error('Admin session check error:', error)
    return { authenticated: false }
  }
}

