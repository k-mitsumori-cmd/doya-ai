// ============================================
// POST /api/copy/generate-search
// ============================================
// 検索広告RSAコピーを生成

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateSearchCopies } from '@/lib/copy/gemini'
import type { ProductInfo, PersonaData } from '@/lib/copy/gemini'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    const { projectId, productInfo, persona, platform, keywords } = await req.json() as {
      projectId: string
      productInfo: ProductInfo
      persona: PersonaData
      platform: 'google' | 'yahoo'
      keywords: string[]
    }

    if (!projectId || !productInfo || !persona) {
      return NextResponse.json({ error: 'projectId、productInfo、personaは必須です' }, { status: 400 })
    }

    const effectiveKeywords = keywords?.length ? keywords : (persona.keywords?.length ? persona.keywords : null)
    if (!effectiveKeywords?.length) {
      return NextResponse.json({ error: '検索キーワードが必要です（keywordsかペルソナのkeywordsを指定してください）' }, { status: 400 })
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

    const searchCopy = await generateSearchCopies(
      productInfo,
      persona,
      platform || 'google',
      effectiveKeywords,
    )

    // DBに保存
    const saved = await prisma.copyItem.create({
      data: {
        projectId,
        type: 'search',
        platform: platform || 'google',
        writerType: 'rsa',
        headline: searchCopy.headlines[0] || '',
        description: searchCopy.descriptions[0] || '',
        catchcopy: searchCopy.displayPath.join('/'),
        cta: '',
        appealAxis: 'RSA',
        hashtags: [],
      },
    })

    return NextResponse.json({ success: true, copy: saved, searchCopy })
  } catch (error: any) {
    console.error('Copy generate-search error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
