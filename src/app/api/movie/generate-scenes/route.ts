import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateScenes } from '@/lib/movie/gemini'
import { prisma } from '@/lib/prisma'
import { getGuestIdFromRequest } from '@/lib/movie/access'
import type { MoviePlan, ProductInfo } from '@/lib/movie/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, plan, productInfo, config, duration, aspectRatio, templateId } = body as {
      projectId: string
      plan: MoviePlan
      productInfo: ProductInfo
      config?: { duration?: number; aspectRatio?: string; templateId?: string }
      duration?: number
      aspectRatio?: string
      templateId?: string
    }

    const finalDuration = duration ?? config?.duration ?? 15
    const finalAspectRatio = aspectRatio ?? config?.aspectRatio ?? '16:9'
    const finalTemplateId = templateId ?? config?.templateId

    const scenes = await generateScenes(plan, productInfo, { duration: finalDuration, aspectRatio: finalAspectRatio, templateId: finalTemplateId })

    if (projectId) {
      // 所有権確認
      const session = await getServerSession(authOptions)
      const guestId = getGuestIdFromRequest(req)
      let userId: string | null = null
      if (session?.user?.email) {
        const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
        userId = user?.id ?? null
      }
      const project = await prisma.movieProject.findUnique({ where: { id: projectId } })
      if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
      const isOwner = (userId && project.userId === userId) || (guestId && project.guestId === guestId)
      if (!isOwner) return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })
      // 既存シーンを削除して新規作成
      await prisma.movieScene.deleteMany({ where: { projectId } })
      await prisma.movieScene.createMany({
        data: scenes.map(s => ({
          projectId,
          order: s.order,
          duration: s.duration,
          bgType: s.bgType,
          bgValue: s.bgValue,
          bgAnimation: s.bgAnimation,
          texts: s.texts as never,
          narrationText: s.narrationText,
          transition: s.transition,
          metadata: s.metadata as never,
        })),
      })
    }

    return NextResponse.json({ scenes })
  } catch (error) {
    console.error('[POST /api/movie/generate-scenes]', error)
    return NextResponse.json({ error: 'シーン生成に失敗しました' }, { status: 500 })
  }
}
