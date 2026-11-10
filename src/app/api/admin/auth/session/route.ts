import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'

// cookies() を使用するため静的最適化を無効化
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401, headers: privateHeaders })
    }

    const session = await verifyAdminSession(token)

    if (session.googleRequired) {
      return NextResponse.json({ authenticated: false, googleRequired: true }, { status: 401, headers: privateHeaders })
    }

    if (!session.valid || !session.adminUser) {
      // 無効なトークンの場合、クッキーを削除
      cookieStore.delete(COOKIE_NAME)
      return NextResponse.json({ authenticated: false }, { status: 401, headers: privateHeaders })
    }

    return NextResponse.json({
      authenticated: true,
      adminUser: session.adminUser,
    }, { headers: privateHeaders })
  } catch (error) {
    console.error('Admin session check error:')
    return NextResponse.json(
      { authenticated: false, error: 'セッション確認中にエラーが発生しました' },
      { status: 500, headers: privateHeaders }
    )
  }
}

