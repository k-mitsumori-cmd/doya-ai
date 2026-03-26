import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PUT: セグメント更新
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
    const { name, key, conditions } = body

    const existing = await prisma.dripSegment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'セグメントが見つかりません' }, { status: 404 })
    }

    // key の重複チェック（自分自身は除外）
    if (key !== undefined && key !== existing.key) {
      const duplicate = await prisma.dripSegment.findFirst({
        where: { key, id: { not: id } },
      })
      if (duplicate) {
        return NextResponse.json({ error: `key "${key}" は既に使用されています` }, { status: 409 })
      }
    }

    const segment = await prisma.dripSegment.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(key !== undefined ? { key } : {}),
        ...(conditions !== undefined ? { conditions } : {}),
      },
    })

    return NextResponse.json(segment)
  } catch (error) {
    console.error('[Drip] Segment update error:', error)
    return NextResponse.json({ error: 'セグメントの更新に失敗しました' }, { status: 500 })
  }
}

// DELETE: セグメント削除
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

    const existing = await prisma.dripSegment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'セグメントが見つかりません' }, { status: 404 })
    }

    // セグメントを使用しているシーケンスがあるか確認
    const usedBySequences = await prisma.dripSequence.count({ where: { segmentId: id } })
    if (usedBySequences > 0) {
      return NextResponse.json(
        { error: `このセグメントは ${usedBySequences} 個のシーケンスで使用中です。先にシーケンスから外してください。` },
        { status: 409 }
      )
    }

    await prisma.dripSegment.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'セグメントを削除しました' })
  } catch (error) {
    console.error('[Drip] Segment delete error:', error)
    return NextResponse.json({ error: 'セグメントの削除に失敗しました' }, { status: 500 })
  }
}
