// ============================================
// GET /api/interview/transcriptions/[id]
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const id = await resolveId(ctx)
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const transcription = await prisma.interviewTranscription.findUnique({
      where: { id },
      include: {
        project: { select: { userId: true, guestId: true } },
      },
    })

    if (!transcription) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(transcription.project, userId, guestId)
    if (ownerErr) return ownerErr

    return NextResponse.json({
      success: true,
      transcription: {
        id: transcription.id,
        projectId: transcription.projectId,
        materialId: transcription.materialId,
        text: transcription.text,
        segments: transcription.segments,
        summary: transcription.summary,
        topics: transcription.topics,
        provider: transcription.provider,
        confidence: transcription.confidence,
        status: transcription.status,
        createdAt: transcription.createdAt.toISOString(),
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '取得に失敗しました' },
      { status: 500 }
    )
  }
}