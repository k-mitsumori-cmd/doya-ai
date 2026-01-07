import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { deleteAdminSession, COOKIE_NAME } from '@/lib/admin-auth'

// cookies() を使用するため、静的最適化を無効化
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (token) {
      // セッションをデータベースから削除
      await deleteAdminSession(token)
    }

    // クッキーを削除
    cookieStore.delete(COOKIE_NAME)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin logout error:', error)
    return NextResponse.json(
      { error: 'ログアウト処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

