import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: セグメント一覧
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const segments = await prisma.dripSegment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { sequences: true } },
      },
    })

    return NextResponse.json(segments)
  } catch (error) {
    console.error('[Drip] Segments list error:', error)
    return NextResponse.json({ error: 'セグメント一覧の取得に失敗しました' }, { status: 500 })
  }
}

// POST: セグメント作成
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { name, key, conditions } = body

    if (!name || !key) {
      return NextResponse.json({ error: 'name, key は必須です' }, { status: 400 })
    }

    // key の重複チェック
    const existingKey = await prisma.dripSegment.findFirst({ where: { key } })
    if (existingKey) {
      return NextResponse.json({ error: `key "${key}" は既に使用されています` }, { status: 409 })
    }

    const segment = await prisma.dripSegment.create({
      data: {
        name,
        key,
        conditions: conditions || {},
      },
    })

    return NextResponse.json(segment, { status: 201 })
  } catch (error) {
    console.error('[Drip] Segment create error:', error)
    return NextResponse.json({ error: 'セグメントの作成に失敗しました' }, { status: 500 })
  }
}
