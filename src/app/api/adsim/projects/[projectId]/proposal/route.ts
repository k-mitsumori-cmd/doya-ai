// ============================================
// POST /api/adsim/projects/[projectId]/proposal
// ============================================
// Gemini で10セクションの提案テキストを生成する。
// デフォルトはバッチモード（全件揃ってから返す）。
// `?stream=1` で SSE ストリーミング（完了した順に text/event-stream で配信）。
// simulate が先に実行されている必要がある。

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  generateProposalSections,
  generateProposalSectionsStream,
  ProposalSection,
} from '@/lib/adsim/gemini'
import { SimulationResult } from '@/lib/adsim/simulator'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const project = await prisma.adSimProject.findUnique({ where: { id: params.projectId } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (project.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!project.simulationData) {
      return NextResponse.json(
        { error: 'シミュレーションが未実行です。先に /simulate を呼び出してください' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(req.url)
    const wantsStream = searchParams.get('stream') === '1'

    const commonInput = {
      clientName: project.clientName,
      industry: project.industry,
      productName: project.productName,
      lpUrl: project.lpUrl || undefined,
      targetAudience: (project.targetAudience as any) || undefined,
      goals: project.goals,
      periodMonths: project.periodMonths,
      monthlyBudget: project.monthlyBudget,
      mediaAllocation: project.mediaAllocation as Record<string, number>,
      simulation: project.simulationData as unknown as SimulationResult,
    }

    if (wantsStream) {
      // ----- SSE モード -----
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          const safeEnqueue = (data: unknown) => {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
            } catch {
              // ignore closed stream
            }
          }

          safeEnqueue({ type: 'start', total: 10 })
          const collected: ProposalSection[] = []

          try {
            for await (const section of generateProposalSectionsStream(commonInput)) {
              collected.push(section)
              safeEnqueue({
                type: 'section',
                completed: collected.length,
                total: 10,
                section,
              })
            }

            // 完了時に DB 更新
            await prisma.adSimProject.update({
              where: { id: params.projectId },
              data: {
                proposalText: collected as unknown as object,
                status: 'completed',
              },
            })

            safeEnqueue({ type: 'done', sections: collected })
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error('[adsim] proposal stream error:', err)
            safeEnqueue({ type: 'error', error: message })
          } finally {
            try {
              controller.close()
            } catch {
              // ignore
            }
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      })
    }

    // ----- バッチモード（既存互換） -----
    const sections = await generateProposalSections(commonInput)
    const updated = await prisma.adSimProject.update({
      where: { id: params.projectId },
      data: {
        proposalText: sections as unknown as object,
        status: 'completed',
      },
    })
    return NextResponse.json({ project: updated, sections })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[adsim] proposal error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
