import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// プロジェクト一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await prisma.interviewProject.findMany({
      where: {
        OR: [{ userId: userId || undefined }, { guestId: guestId || undefined }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('[INTERVIEW] Projects fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

// プロジェクト作成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, intervieweeName, intervieweeRole, intervieweeCompany, theme, purpose, targetAudience, tone, mediaType } = body

    const project = await prisma.interviewProject.create({
      data: {
        userId: userId || undefined,
        guestId: guestId || undefined,
        title: title || '無題のプロジェクト',
        intervieweeName,
        intervieweeRole,
        intervieweeCompany,
        theme,
        purpose,
        targetAudience,
        tone: tone || 'friendly',
        mediaType,
        status: 'DRAFT',
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('[INTERVIEW] Project creation error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

