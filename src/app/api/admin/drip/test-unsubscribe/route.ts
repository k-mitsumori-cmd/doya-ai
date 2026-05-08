import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { generateUnsubscribeToken } from '@/lib/drip-tokens'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 管理者専用: テスト用配信停止トークンを生成
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const { valid } = await verifyAdminSession(token || null)
  if (!valid) {
    return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
  }

  const userId = request.nextUrl.searchParams.get('userId') || 'test-user'
  const unsubToken = generateUnsubscribeToken(userId)
  const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.VERCEL_URL}` || 'https://doya-ai.surisuta.jp'

  return NextResponse.json({
    token: unsubToken,
    unsubscribeUrl: `${baseUrl}/api/drip/unsubscribe?token=${unsubToken}`,
  })
}
