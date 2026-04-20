export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildCopyPrompt } from '@/lib/lp/prompts'
import type { LpProductInfo, LpPurpose, LpSectionDef, LpStructure } from '@/lib/lp/types'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, selectedStructure } = await req.json() as {
      projectId: string
      selectedStructure: number
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const project = await prisma.lpProject.findFirst({
      where: { id: projectId, userId: session.user.id },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const structures = project.structures as any as LpStructure[]
    const structureIdx = selectedStructure ?? project.selectedStructure ?? 0
    const structure = structures?.[structureIdx]

    if (!structure) {
      return NextResponse.json({ error: 'Structure not found. Generate structures first.' }, { status: 400 })
    }

    const productInfo = project.productInfo as any as LpProductInfo
    const purposes = (project.purpose || []) as LpPurpose[]

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // selectedStructure を保存
          await prisma.lpProject.update({
            where: { id: projectId },
            data: { selectedStructure: structureIdx },
          })

          const sections = structure.sections || []
          const total = sections.length

          for (let i = 0; i < sections.length; i++) {
            const sectionDef = sections[i] as LpSectionDef

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'progress', current: i + 1, total, sectionName: sectionDef.name })}\n\n`
              )
            )

            const prompt = buildCopyPrompt(productInfo, sectionDef, purposes)
            let copyData: {
              headline?: string
              subheadline?: string
              body?: string
              ctaText?: string | null
              items?: any[]
            } = {}

            try {
              copyData = await geminiGenerateJson<typeof copyData>({ model: GEMINI_TEXT_MODEL_DEFAULT, prompt }) || {}
            } catch {
              copyData = { headline: sectionDef.name }
            }

            // DB upsert
            const existing = await prisma.lpSection.findFirst({
              where: { projectId, order: i },
            })

            let savedSection
            if (existing) {
              savedSection = await prisma.lpSection.update({
                where: { id: existing.id },
                data: {
                  type: sectionDef.type,
                  name: sectionDef.name,
                  purpose: sectionDef.purpose,
                  headline: copyData.headline || null,
                  subheadline: copyData.subheadline || null,
                  body: copyData.body || null,
                  ctaText: copyData.ctaText || null,
                  items: (copyData.items || null) as any,
                },
              })
            } else {
              savedSection = await prisma.lpSection.create({
                data: {
                  projectId,
                  order: i,
                  type: sectionDef.type,
                  name: sectionDef.name,
                  purpose: sectionDef.purpose,
                  headline: copyData.headline || null,
                  subheadline: copyData.subheadline || null,
                  body: copyData.body || null,
                  ctaText: copyData.ctaText || null,
                  items: (copyData.items || null) as any,
                },
              })
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'section', section: savedSection })}\n\n`
              )
            )
          }

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
    console.error('[POST /api/lp/generate-copy]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
