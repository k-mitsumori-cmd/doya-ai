import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: テンプレート詳細
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { id } = await params

    const template = await prisma.dripTemplate.findUnique({
      where: { id },
      include: {
        steps: {
          select: {
            id: true,
            label: true,
            sequenceId: true,
            sequence: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('[Drip] Template detail error:', error)
    return NextResponse.json({ error: 'テンプレートの取得に失敗しました' }, { status: 500 })
  }
}

// PUT: テンプレート更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, subject, bodyHtml, bodyText, variables } = body

    const existing = await prisma.dripTemplate.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
    }

    const template = await prisma.dripTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(subject !== undefined ? { subject } : {}),
        ...(bodyHtml !== undefined ? { bodyHtml } : {}),
        ...(bodyText !== undefined ? { bodyText } : {}),
        ...(variables !== undefined ? { variables } : {}),
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('[Drip] Template update error:', error)
    return NextResponse.json({ error: 'テンプレートの更新に失敗しました' }, { status: 500 })
  }
}

// DELETE: テンプレート削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.dripTemplate.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
    }

    // テンプレートを使用しているステップがあるか確認
    const usedBySteps = await prisma.dripStep.count({ where: { templateId: id } })
    if (usedBySteps > 0) {
      return NextResponse.json(
        { error: `このテンプレートは ${usedBySteps} 個のステップで使用中です。先にステップから外してください。` },
        { status: 409 }
      )
    }

    await prisma.dripTemplate.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'テンプレートを削除しました' })
  } catch (error) {
    console.error('[Drip] Template delete error:', error)
    return NextResponse.json({ error: 'テンプレートの削除に失敗しました' }, { status: 500 })
  }
}
