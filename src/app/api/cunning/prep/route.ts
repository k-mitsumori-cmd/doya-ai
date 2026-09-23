export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { canStartSession } from '@/lib/cunning/limits'
import { generatePrep } from '@/lib/cunning/prep'
import { resolveSessionContext } from '@/lib/cunning/context'
import { admitCunningAnswer } from '@/lib/cunning/answer-admission'
import type { KnowledgeChunkLite } from '@/lib/cunning/types'

// POST /api/cunning/prep — セッションのコンテキストから想定問答を生成
// body: { sessionId }
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: '入力が不正です' }, { status: 400 })
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
    if (!sessionId) return NextResponse.json({ error: 'sessionIdが必要です' }, { status: 400 })

    const ctx = await resolveSessionContext(userId, sessionId)
    if (!ctx) return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })

    if (ctx.status !== 'active') return NextResponse.json({ error: '終了したセッションでは想定問答を生成できません' }, { status: 409 })
    const lease = ctx.recordingVersion === 2 ? await prisma.cunningRecordingLease.findUnique({ where: { sessionId }, select: { sessionId: true } }) : null
    if (lease) {
      if (typeof body.recordingToken !== 'string') return NextResponse.json({ error: '録音識別子が必要です' }, { status: 400 })
      const admission = await admitCunningAnswer(prisma, userId, sessionId, body.recordingToken)
      if (!admission.accepted) return NextResponse.json({ error: '録音の有効期限が切れています。', code: 'RECORDING_ENDED' }, { status: 409 })
    } else {
      const allowance = await canStartSession(userId)
      if (!allowance.ok) return NextResponse.json({ error: allowance.reason, code: allowance.code ?? 'LIMIT', ...(allowance.code === 'RECORDING_RESERVED' ? {} : { upgradeUrl: '/cunning/pricing' }) }, { status: 403 })
    }

    let chunks: KnowledgeChunkLite[] | undefined
    if (ctx.knowledgeBaseId) {
      // 事前準備は全体傾向を見るため、先頭の代表チャンクを多めに渡す
      chunks = await prisma.cunningKnowledgeChunk.findMany({
        where: { knowledgeBaseId: ctx.knowledgeBaseId },
        select: { id: true, content: true, sourceUrl: true, sourceLabel: true },
        take: 10,
      })
    }

    const items = await generatePrep({
      mode: ctx.mode,
      chunks,
      company: ctx.company,
      applicant: ctx.applicant,
      personaNote: ctx.personaNote,
      count: body.count,
    })
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[cunning/prep] processing failed')
    return NextResponse.json({ error: '想定問答の生成に失敗しました' }, { status: 500 })
  }
}
