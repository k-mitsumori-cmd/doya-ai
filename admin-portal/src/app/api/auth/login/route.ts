import { NextRequest, NextResponse } from 'next/server'
import { authenticateAccount, COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string }
    const email = (body.email || '').trim()
    const password = body.password || ''
    
    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスを入力してください' },
        { status: 400 }
      )
    }
    if (!password) {
      return NextResponse.json(
        { error: 'パスワードを入力してください' },
        { status: 400 }
      )
    }
    
    const token = await authenticateAccount(email, password)
    
    if (!token) {
      return NextResponse.json(
        { error: 'メールアドレスまたはパスワードが正しくありません' },
        { status: 401 }
      )
    }
    
    const response = NextResponse.json({ success: true })
    
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24時間
      path: '/',
    })
    
    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

