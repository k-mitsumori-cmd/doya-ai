import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: シーケンス詳細（ステップ・セグメント情報含む）
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

    const sequence = await prisma.dripSequence.findUnique({
      where: { id },
      include: {
        segment: true,
        steps: {
          orderBy: { sortOrder: 'asc' },
          include: {
            template: { select: { id: true, name: true, subject: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
    })

    if (!sequence) {
      return NextResponse.json({ error: 'シーケンスが見つかりません' }, { status: 404 })
    }

    return NextResponse.json(sequence)
  } catch (error) {
    console.error('[Drip] Sequence detail error:', error)
    return NextResponse.json({ error: 'シーケンスの取得に失敗しました' }, { status: 500 })
  }
}

// PUT: シーケンス更新
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
    const { name, status, segmentId } = body

    const existing = await prisma.dripSequence.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'シーケンスが見つかりません' }, { status: 404 })
    }

    const sequence = await prisma.dripSequence.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(segmentId !== undefined ? { segmentId: segmentId || null } : {}),
      },
      include: {
        segment: true,
        steps: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return NextResponse.json(sequence)
  } catch (error) {
    console.error('[Drip] Sequence update error:', error)
    return NextResponse.json({ error: 'シーケンスの更新に失敗しました' }, { status: 500 })
  }
}

// DELETE: シーケンス削除
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

    const existing = await prisma.dripSequence.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'シーケンスが見つかりません' }, { status: 404 })
    }

    // 関連データを削除
    await prisma.dripEmailLog.deleteMany({ where: { sequenceId: id } })
    await prisma.dripEnrollment.deleteMany({ where: { sequenceId: id } })
    await prisma.dripStep.deleteMany({ where: { sequenceId: id } })
    await prisma.dripSequence.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'シーケンスを削除しました' })
  } catch (error) {
    console.error('[Drip] Sequence delete error:', error)
    return NextResponse.json({ error: 'シーケンスの削除に失敗しました' }, { status: 500 })
  }
}
