import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (currentUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        plan: true,
        role: true,
        createdAt: true,
        _count: {
          select: { generations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formattedUsers = users.map((user: any) => ({
      ...user,
      totalGenerations: user._count.generations,
      _count: undefined,
    }))

    return NextResponse.json(formattedUsers)
  } catch (error) {
    console.error('Admin users error:', error)
    return NextResponse.json(
      { error: 'ユーザー一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (currentUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const { userId, plan, role } = await req.json()

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(plan && { plan }),
        ...(role && { role }),
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Admin user update error:', error)
    return NextResponse.json(
      { error: 'ユーザーの更新に失敗しました' },
      { status: 500 }
    )
  }
}

