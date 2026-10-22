import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { privateApiJson } from '@/lib/private-api-response'

// cookies() を使用するため静的最適化を無効化
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (!token) {
      return privateApiJson({ authenticated: false }, { status: 401 })
    }

    const session = await verifyAdminSession(token)

    if (!session.valid || !session.adminUser) {
      // 無効なトークンの場合、クッキーを削除
      cookieStore.delete(COOKIE_NAME)
      return privateApiJson({ authenticated: false }, { status: 401 })
    }

    return privateApiJson({
      authenticated: true,
      adminUser: session.adminUser,
    })
  } catch (error) {
    console.error('Admin session check error:')
    return privateApiJson(
      { authenticated: false, error: 'セッション確認中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

