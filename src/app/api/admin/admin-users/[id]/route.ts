import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME, hashPassword, validatePassword } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 管理者を更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid, adminUser: currentAdmin } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { isActive, password, name, email } = body

    // 対象の管理者を確認
    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id },
    })

    if (!targetAdmin) {
      return NextResponse.json({ error: '管理者が見つかりません' }, { status: 404 })
    }

    const updateData: any = {}

    // 有効/無効の切り替え
    if (typeof isActive === 'boolean') {
      // 自分自身を無効化しようとしている場合はエラー
      if (currentAdmin?.id === id && !isActive) {
        return NextResponse.json({ error: '自分自身を無効化することはできません' }, { status: 400 })
      }
      updateData.isActive = isActive
    }

    // パスワード変更
    if (password) {
      const passwordValidation = validatePassword(password)
      if (!passwordValidation.valid) {
        return NextResponse.json({ 
          error: 'パスワードが要件を満たしていません',
          details: passwordValidation.errors,
        }, { status: 400 })
      }
      updateData.passwordHash = await hashPassword(password)
    }

    // 名前変更
    if (name !== undefined) {
      updateData.name = name || null
    }

    // メール変更
    if (email !== undefined) {
      // 重複チェック
      if (email) {
        const existingUser = await prisma.adminUser.findFirst({
          where: {
            email,
            id: { not: id },
          },
        })
        if (existingUser) {
          return NextResponse.json({ error: 'このメールアドレスは既に使用されています' }, { status: 400 })
        }
      }
      updateData.email = email || null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '更新するデータがありません' }, { status: 400 })
    }

    const updatedAdmin = await prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        isActive: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(updatedAdmin)
  } catch (error) {
    console.error('Update admin user error:', error)
    return NextResponse.json({ error: '管理者の更新に失敗しました' }, { status: 500 })
  }
}

// 管理者を削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid, adminUser: currentAdmin } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { id } = await params

    // 自分自身を削除しようとしている場合はエラー
    if (currentAdmin?.id === id) {
      return NextResponse.json({ error: '自分自身を削除することはできません' }, { status: 400 })
    }

    // 対象の管理者を確認
    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id },
    })

    if (!targetAdmin) {
      return NextResponse.json({ error: '管理者が見つかりません' }, { status: 404 })
    }

    // 最後の管理者は削除できない
    const adminCount = await prisma.adminUser.count()
    if (adminCount <= 1) {
      return NextResponse.json({ error: '最後の管理者は削除できません' }, { status: 400 })
    }

    // 関連するセッションも削除
    await prisma.adminSession.deleteMany({
      where: { adminUserId: id },
    })

    // 管理者を削除
    await prisma.adminUser.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete admin user error:', error)
    return NextResponse.json({ error: '管理者の削除に失敗しました' }, { status: 500 })
  }
}
