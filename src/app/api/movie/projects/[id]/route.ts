import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGuestIdFromRequest } from '@/lib/movie/access'

// GET /api/movie/projects/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const guestId = getGuestIdFromRequest(req)

    const project = await prisma.movieProject.findUnique({
      where: { id },
      include: {
        scenes: { orderBy: { order: 'asc' } },
        renderJobs: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    let userId: string | null = null
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      userId = user?.id ?? null
    }

    const isOwner = (userId && project.userId === userId) || (guestId && project.guestId === guestId)
    if (!isOwner) return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('[GET /api/movie/projects/[id]]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// PUT /api/movie/projects/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const guestId = getGuestIdFromRequest(req)

    const project = await prisma.movieProject.findUnique({ where: { id } })
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    let userId: string | null = null
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      userId = user?.id ?? null
    }

    const isOwner = (userId && project.userId === userId) || (guestId && project.guestId === guestId)
    if (!isOwner) return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })

    const body = await req.json()
    const { name, status, productInfo, persona, templateId, aspectRatio, duration, resolution, platform, plans, selectedPlan, outputUrl, thumbnailUrl } = body

    const updated = await prisma.movieProject.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(status !== undefined && { status }),
        ...(productInfo !== undefined && { productInfo }),
        ...(persona !== undefined && { persona }),
        ...(templateId !== undefined && { templateId }),
        ...(aspectRatio !== undefined && { aspectRatio }),
        ...(duration !== undefined && { duration }),
        ...(resolution !== undefined && { resolution }),
        ...(platform !== undefined && { platform }),
        ...(plans !== undefined && { plans }),
        ...(selectedPlan !== undefined && { selectedPlan }),
        ...(outputUrl !== undefined && { outputUrl }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
      },
      include: { scenes: { orderBy: { order: 'asc' } }, renderJobs: true },
    })

    return NextResponse.json({ project: updated })
  } catch (error) {
    console.error('[PUT /api/movie/projects/[id]]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// DELETE /api/movie/projects/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const guestId = getGuestIdFromRequest(req)

    const project = await prisma.movieProject.findUnique({ where: { id } })
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    let userId: string | null = null
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      userId = user?.id ?? null
    }

    const isOwner = (userId && project.userId === userId) || (guestId && project.guestId === guestId)
    if (!isOwner) return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })

    await prisma.movieProject.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/movie/projects/[id]]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
