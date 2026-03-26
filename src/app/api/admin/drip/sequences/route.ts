import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: シーケンス一覧（ステップ数・セグメント名・登録者数を含む）
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const sequences = await prisma.dripSequence.findMany({
      include: {
        segment: { select: { id: true, name: true } },
        _count: {
          select: {
            steps: true,
            enrollments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = sequences.map((seq: any) => ({
      id: seq.id,
      name: seq.name,
      status: seq.status,
      segmentId: seq.segmentId,
      segmentName: seq.segment?.name || null,
      stepCount: seq._count.steps,
      enrollmentCount: seq._count.enrollments,
      createdAt: seq.createdAt,
      updatedAt: seq.updatedAt,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Drip] Sequences list error:', error)
    return NextResponse.json({ error: 'シーケンス一覧の取得に失敗しました' }, { status: 500 })
  }
}

// POST: シーケンス作成
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { name, status, segmentId } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name は必須です' }, { status: 400 })
    }

    const sequence = await prisma.dripSequence.create({
      data: {
        name,
        status: status || 'draft',
        ...(segmentId ? { segmentId } : {}),
      },
      include: {
        segment: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(sequence, { status: 201 })
  } catch (error) {
    console.error('[Drip] Sequence create error:', error)
    return NextResponse.json({ error: 'シーケンスの作成に失敗しました' }, { status: 500 })
  }
}
