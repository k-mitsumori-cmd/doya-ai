import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const STALE_THRESHOLD_MS = 5 * 60 * 1000 // 5分

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const project = await prisma.openingProject.findUnique({
      where: { id: params.id },
      include: {
        animations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // ANALYZINGステータスが5分以上続いている場合、ERRORに自動更新
    if (
      project.status === 'ANALYZING' &&
      Date.now() - new Date(project.createdAt).getTime() > STALE_THRESHOLD_MS
    ) {
      const updated = await prisma.openingProject.update({
        where: { id: params.id },
        data: { status: 'ERROR' },
        include: {
          animations: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })
      return NextResponse.json({ project: updated })
    }

    return NextResponse.json({ project })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    const project = await prisma.openingProject.findUnique({
      where: { id: params.id },
    })

    if (!project || (project.userId && project.userId !== userId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.openingProject.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
