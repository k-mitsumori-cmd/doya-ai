export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildBrushupPrompt } from '@/lib/lp/prompts'
import type { LpProductInfo } from '@/lib/lp/types'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sectionId, instruction, productInfo } = await req.json() as {
      sectionId: string
      instruction: string
      productInfo?: LpProductInfo
    }

    if (!sectionId || !instruction) {
      return NextResponse.json({ error: 'sectionId and instruction are required' }, { status: 400 })
    }

    const section = await prisma.lpSection.findFirst({
      where: { id: sectionId },
      include: { project: true },
    })

    if (!section || !section.project || section.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const info = productInfo || (section.project.productInfo as any as LpProductInfo) || { name: '', target: '' }

    const prompt = buildBrushupPrompt(
      info,
      section.name,
      { headline: section.headline, body: section.body },
      instruction
    )

    const result = await geminiGenerateJson<{ headline: string; body: string }>({ model: GEMINI_TEXT_MODEL_DEFAULT, prompt })

    // リビジョン履歴に現在のコピーを保存
    const revisions = [...((section.revisions as any[]) || []), {
      headline: section.headline,
      body: section.body,
      timestamp: new Date().toISOString(),
    }]

    const updated = await prisma.lpSection.update({
      where: { id: sectionId },
      data: {
        headline: result?.headline || section.headline,
        body: result?.body || section.body,
        revisions: revisions as any,
      },
    })

    return NextResponse.json({ section: updated })
  } catch (error) {
    console.error('[POST /api/lp/brushup-section]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
