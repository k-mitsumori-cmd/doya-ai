import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// プロジェクト詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await prisma.interviewProject.findFirst({
      where: {
        id: params.id,
        OR: [{ userId: userId || undefined }, { guestId: guestId || undefined }],
      },
      include: {
        materials: {
          orderBy: { createdAt: 'desc' },
        },
        transcriptions: {
          orderBy: { createdAt: 'desc' },
        },
        drafts: {
          orderBy: { version: 'desc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
        },
        recipe: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('[INTERVIEW] Project fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

// プロジェクト更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const project = await prisma.interviewProject.updateMany({
      where: {
        id: params.id,
        OR: [{ userId: userId || undefined }, { guestId: guestId || undefined }],
      },
      data: {
        ...body,
        updatedAt: new Date(),
      },
    })

    if (project.count === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[INTERVIEW] Project update error:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

// プロジェクト削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await prisma.interviewProject.deleteMany({
      where: {
        id: params.id,
        OR: [{ userId: userId || undefined }, { guestId: guestId || undefined }],
      },
    })

    if (project.count === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[INTERVIEW] Project delete error:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}

