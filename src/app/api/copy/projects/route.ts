// ============================================
// GET/POST /api/copy/projects
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - プロジェクト一覧取得
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    if (!userId) {
      return NextResponse.json({ projects: [] })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = parseInt(searchParams.get('offset') || '0')

    const [projects, total] = await Promise.all([
      prisma.copyProject.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { copies: true } },
        },
      }),
      prisma.copyProject.count({ where: { userId } }),
    ])

    return NextResponse.json({ projects, total })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Copy projects GET error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST - プロジェクト作成
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    const body = await req.json()
    const { name, productUrl, productInfo, persona, personaSource, regulations, brandVoiceId } = body

    if (!name) {
      return NextResponse.json({ error: 'プロジェクト名が必要です' }, { status: 400 })
    }

    const project = await prisma.copyProject.create({
      data: {
        userId: userId || null,
        guestId: userId ? null : `guest_${Date.now()}`,
        name,
        productUrl: productUrl || null,
        productInfo: productInfo || {},
        persona: persona || {},
        personaSource: personaSource || null,
        regulations: regulations || {},
        brandVoiceId: brandVoiceId || null,
        status: 'active',
      } as any, // Prisma schema types userId as String but DB column is nullable (String?)
    })

    return NextResponse.json({ success: true, project })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Copy projects POST error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
