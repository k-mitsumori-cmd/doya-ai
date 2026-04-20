export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildStructurePrompt } from '@/lib/lp/prompts'
import type { LpProductInfo, LpPurpose, LpStructure } from '@/lib/lp/types'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, productInfo, purposes } = await req.json() as {
      projectId: string
      productInfo: LpProductInfo
      purposes: LpPurpose[]
    }

    if (!projectId || !productInfo) {
      return NextResponse.json({ error: 'projectId and productInfo are required' }, { status: 400 })
    }

    const project = await prisma.lpProject.findFirst({
      where: { id: projectId, userId: session.user.id },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'status', message: 'LP構成案を生成中...' })}\n\n`)
          )

          const prompt = buildStructurePrompt(productInfo, purposes || [])
          const result = await geminiGenerateJson<{ structures: LpStructure[] }>({ model: GEMINI_TEXT_MODEL_DEFAULT, prompt })
          const structures = result?.structures || []

          // DB保存
          await prisma.lpProject.update({
            where: { id: projectId },
            data: {
              structures: structures as any,
              productInfo: productInfo as any,
              purpose: purposes || [],
              status: 'editing',
            },
          })

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'structures', structures })}\n\n`
            )
          )
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          )
        } catch (e) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: String(e) })}\n\n`
            )
          )
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[POST /api/lp/generate-structure]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
