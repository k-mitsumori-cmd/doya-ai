import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME, hashPassword, validatePassword } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 管理者一覧を取得
export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const admins = await prisma.adminUser.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(admins)
  } catch (error) {
    console.error('Get admin users error:', error)
    return NextResponse.json({ error: '管理者一覧の取得に失敗しました' }, { status: 500 })
  }
}

// 管理者を追加
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { username, email, name, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: 'ユーザー名とパスワードは必須です' }, { status: 400 })
    }

    // パスワード検証
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json({ 
        error: 'パスワードが要件を満たしていません',
        details: passwordValidation.errors,
      }, { status: 400 })
    }

    // ユーザー名の重複チェック
    const existingUser = await prisma.adminUser.findFirst({
      where: {
        OR: [
          { username },
          ...(email ? [{ email }] : []),
        ],
      },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'ユーザー名またはメールアドレスは既に使用されています' }, { status: 400 })
    }

    // パスワードをハッシュ化
    const passwordHash = await hashPassword(password)

    // 管理者を作成
    const newAdmin = await prisma.adminUser.create({
      data: {
        username,
        email: email || null,
        name: name || null,
        passwordHash,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json(newAdmin, { status: 201 })
  } catch (error) {
    console.error('Create admin user error:', error)
    return NextResponse.json({ error: '管理者の作成に失敗しました' }, { status: 500 })
  }
}
