export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { readCunningTranscripts, readRecentCunningTranscripts } from '@/lib/cunning/history-read'
import { encodeCunningTranscriptCursor, encodeCunningCursor } from '@/lib/cunning/history-cursor'
import { cunningReportFingerprint, cunningReportStatus } from '@/lib/cunning/report-freshness'
import { writeCunningSession } from '@/lib/cunning/session-write'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { MODE_IDS } from '@/lib/cunning/modes'

type Ctx = { params: Promise<{ id: string }> }

async function ownedSession(userId: string, id: string) {
  const s = await prisma.cunningSession.findUnique({ where: { id } })
  if (!s || s.userId !== userId || s.status === 'deleted') return null
  return s
}

// GET /api/cunning/sessions/[id] — 詳細（文字起こし・回答履歴）
export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = await ctx.params
  const liveView = new URL(req.url).searchParams.get('view') === 'live'

  return prisma.$transaction(async tx => {
    if (!await tx.user.findUnique({ where: { id: userId }, select: { id: true } })) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const session = await tx.cunningSession.findUnique({
      where: { id: p.id },
      include: {
        answers: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: liveView ? 0 : 201 },
        _count: { select: { transcripts: true, answers: true } },
      },
    })
    if (!session || session.userId !== userId || session.status === 'deleted') return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    if (liveView) {
      const recordingLease = session.recordingVersion === 2 ? await tx.cunningRecordingLease.findUnique({
        where: { sessionId: p.id }, select: { stoppedAt: true },
      }) : null
      const liveHistory = {
        transcripts: await readRecentCunningTranscripts(tx, userId, p.id, 81),
        answers: (await tx.cunningAnswer.findMany({
          where: { sessionId: p.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 200,
        })).reverse(),
        totals: session._count,
      }
      return NextResponse.json({ session: {
        id: session.id, durationSec: session.durationSec, status: session.status,
        recordingVersion: session.recordingVersion, mode: session.mode, liveHistory,
        interruptedRecording: session.status === 'active' && !!recordingLease && !recordingLease.stoppedAt,
      } }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const transcripts = await readCunningTranscripts(tx, userId, p.id, 501)
    const reportStatus = session.report ? cunningReportStatus(session.report, await cunningReportFingerprint(tx, userId, p.id, session.updatedAt)) : null
    const pagination = {
      transcripts: transcripts.length > 500 ? encodeCunningTranscriptCursor(transcripts[499], p.id, session.updatedAt) : null,
      answers: session.answers.length > 200 ? encodeCunningCursor(session.answers[199]) : null,
    }
    return NextResponse.json({ session: { ...session, transcripts: transcripts.slice(0, 500), answers: session.answers.slice(0, 200), reportStatus, pagination, totals: session._count } }, { headers: { 'Cache-Control': 'no-store' } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
}

// PATCH /api/cunning/sessions/[id] — 利用時間の加算 / 終了
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = await ctx.params
  const s = await ownedSession(userId, p.id)
  if (!s) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: '入力が不正です' }, { status: 400 })
  if (s.recordingVersion === 2 && ('totalSeconds' in body || 'addSeconds' in body || body.end === true)) {
    return NextResponse.json({ error: '画面を再読み込みしてください。録音時間の管理方式が更新されました。', code: 'RECORDING_VERSION' }, { status: 409 })
  }
  const data: any = {}
  // Legacy incremental clients must reload; retrying an increment cannot be made idempotent.
  if ('addSeconds' in body) return NextResponse.json({ error: '画面を再読み込みしてください。利用時間の送信方式が更新されました。' }, { status: 409 })
  if ('totalSeconds' in body && (!Number.isSafeInteger(body.totalSeconds) || body.totalSeconds < 0 || body.totalSeconds > 2147483647)) {
    return NextResponse.json({ error: '利用時間が不正です' }, { status: 400 })
  }
  if (body.title && typeof body.title === 'string') data.title = body.title.trim().slice(0, 120)
  // セッション途中のモード変更（商談→激詰め 等）。以降の回答生成は新モードで行われる。
  if (typeof body.mode === 'string' && MODE_IDS.includes(body.mode as any)) data.mode = body.mode

  let updated: unknown = null
  const saved = await writeCunningSession(userId, p.id, async (tx, current) => {
    // The row lock makes retries and out-of-order delivery converge to one cumulative value.
    if (typeof body.totalSeconds === 'number' && body.totalSeconds > current.durationSec) data.durationSec = body.totalSeconds
    if (body.end === true && (current.status !== 'ended' || !current.endedAt)) {
      data.status = 'ended'
      data.endedAt = current.endedAt ?? new Date()
    }
    if (data.title === current.title) delete data.title
    if (data.mode === current.mode) delete data.mode
    if (Object.keys(data).length === 0) { updated = current; return false }
    updated = await tx.cunningSession.update({ where: { id: p.id }, data })
  })
  if (!saved) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  return NextResponse.json({ session: updated })
}

// DELETE /api/cunning/sessions/[id]
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = await ctx.params
  const s = await ownedSession(userId, p.id)
  if (!s) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  const deleted = await writeCunningSession(userId, p.id, async tx => {
    await tx.cunningTranscript.deleteMany({ where: { sessionId: p.id } })
    await tx.cunningAnswer.deleteMany({ where: { sessionId: p.id } })
    await tx.cunningSession.update({ where: { id: p.id }, data: {
      status: 'deleted', title: '', personaNote: null, report: Prisma.DbNull,
      knowledgeBaseId: null, companyProfileId: null, applicantProfileId: null,
      mode: 'sales',
    } })
  })
  if (!deleted) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
