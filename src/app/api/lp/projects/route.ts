export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const projects = await prisma.lpProject.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { sections: true } },
        sections: {
          orderBy: { order: 'asc' },
          take: 1,
          select: { id: true, name: true, type: true },
        },
      },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('[GET /api/lp/projects]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, purpose, productInfo, themeId } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const project = await prisma.lpProject.create({
      data: {
        userId: session.user.id,
        name,
        purpose: purpose || [],
        productInfo: productInfo || null,
        themeId: themeId || 'minimal',
        status: 'draft',
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('[POST /api/lp/projects]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
