// ============================================
// POST /api/copy/generate-sns
// ============================================
// SNS広告コピーを生成

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateSnsCopies } from '@/lib/copy/gemini'
import type { ProductInfo, PersonaData } from '@/lib/copy/gemini'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    const { projectId, productInfo, persona, platforms } = await req.json() as {
      projectId: string
      productInfo: ProductInfo
      persona: PersonaData
      platforms: string[]
    }

    if (!projectId || !productInfo || !persona) {
      return NextResponse.json({ error: 'projectId、productInfo、personaは必須です' }, { status: 400 })
    }

    const project = await prisma.copyProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    if (project.userId && project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
    }

    const snsCopies = await generateSnsCopies(
      productInfo,
      persona,
      platforms || ['meta'],
    )

    // DBに保存
    const savedItems = await Promise.all(
      snsCopies.map(snsCopy =>
        prisma.copyItem.create({
          data: {
            projectId,
            type: 'sns',
            platform: snsCopy.platform,
            writerType: 'sns',
            headline: snsCopy.headline,
            description: snsCopy.description,
            catchcopy: snsCopy.primaryText,
            cta: snsCopy.cta,
            appealAxis: 'SNS',
            hashtags: snsCopy.hashtags,
          },
        })
      )
    )

    return NextResponse.json({ success: true, copies: savedItems, snsCopies })
  } catch (error: any) {
    console.error('Copy generate-sns error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
