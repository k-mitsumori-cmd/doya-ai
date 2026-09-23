export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { cunningReportFingerprint, cunningReportStatus } from '@/lib/cunning/report-freshness'
import { nextCunningRevision } from '@/lib/cunning/session-write'
import { generateReport } from '@/lib/cunning/report'
import type { CunningMode } from '@/lib/cunning/types'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/cunning/sessions/[id]/report — 議事録＋評価を生成して保存。
// body: { force?: boolean } 既存があれば再生成せず返す（force=trueで再生成）
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = await ctx.params

    const body = await req.json().catch(() => ({}))
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: '入力が不正です' }, { status: 400 })

    // Capture inputs and reserve a generation revision while content writers are excluded.
    // No provider work runs while this row is locked.
    const snapshot = await prisma.$transaction(async tx => {
      const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
      if (!users.length) return null
      await tx.$queryRaw`SELECT id FROM cunning_sessions WHERE id = ${p.id} AND "userId" = ${userId} FOR NO KEY UPDATE`
      const current = await tx.cunningSession.findUnique({
        where: { id: p.id },
        include: {
          transcripts: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { text: true, speaker: true, audioReceivedAt: true, createdAt: true, audioWindow: { select: { sequence: true } } } },
          answers: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { questionText: true, summary: true, script: true } },
          audioWindows: { select: { speaker: true, sequence: true, transcriptId: true, transcript: { select: { recordingFinal: true } } } },
        },
      })
      if (!current || current.userId !== userId || current.status === 'deleted') return null
      if (current.recordingVersion === 2 && current.audioWindows.length) {
        const last = new Map<string, (typeof current.audioWindows)[number]>()
        for (const window of current.audioWindows) {
          if (!window.transcriptId || !window.transcript) return { audioPending: true as const }
          if (!last.has(window.speaker) || last.get(window.speaker)!.sequence < window.sequence) last.set(window.speaker, window)
        }
        if (current.status === 'active' || [...last.values()].some(window => !window.transcript!.recordingFinal)) return { audioPending: true as const }
      }
      // Provider completion order is not conversation order. Stable sort retains
      // the createdAt/id tie-breakers, including legacy rows without receipt time.
      current.transcripts.sort((a, b) =>
        (a.audioReceivedAt ?? a.createdAt).getTime() - (b.audioReceivedAt ?? b.createdAt).getTime() ||
        (a.audioWindow?.sequence ?? Number.MAX_SAFE_INTEGER) - (b.audioWindow?.sequence ?? Number.MAX_SAFE_INTEGER))
      const fingerprint = await cunningReportFingerprint(tx, userId, p.id, current.updatedAt)
      if (current.report && body.force !== true) return { session: current, cached: true, fingerprint }
      const revision = nextCunningRevision(current.updatedAt)
      await tx.cunningSession.update({ where: { id: p.id }, data: { updatedAt: revision } })
      return { session: { ...current, updatedAt: revision }, cached: false, fingerprint }
    })
    if (!snapshot) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    if ('audioPending' in snapshot) return NextResponse.json({ error: '保存されていない音声、または確定前の音声があります。音声の保存を完了してから議事録を作成してください。', code: 'AUDIO_PENDING' }, { status: 409, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
    const { session } = snapshot
    if (snapshot.cached) return NextResponse.json({ report: session.report, reportStatus: cunningReportStatus(session.report, snapshot.fingerprint) }, { headers: { 'Cache-Control': 'no-store' } })

    // 出力言語: クライアントの選択（ja/en/auto）。未指定は auto（会話の主要言語に追従）。
    const langRaw = typeof body.language === 'string' ? body.language : 'auto'
    const language: 'ja' | 'en' | 'auto' = langRaw === 'en' ? 'en' : langRaw === 'ja' ? 'ja' : 'auto'

    const report = await generateReport({
      mode: session.mode as CunningMode,
      transcripts: session.transcripts.map((t) => `${t.speaker === 'self' ? '自分' : '相手'}: ${t.text}`),
      answers: session.answers.map((a) => ({ question: a.questionText, summary: a.summary, script: a.script })),
      personaNote: session.personaNote,
      language,
    })

    const previousIncomplete = session.report && typeof session.report === 'object' && !Array.isArray(session.report) && session.report.incompleteInput === true
    const persistedReport = { ...report, sourceFingerprint: snapshot.fingerprint, incompleteInput: body.incompleteInput === true || Boolean(previousIncomplete), sourceCoverage: { transcripts: session.transcripts.length, answers: session.answers.length } }
    const saved = await prisma.$transaction(async tx => {
      const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
      if (!users.length) return { count: 0 }
      return tx.cunningSession.updateMany({ where: { id: p.id, userId, status: { not: 'deleted' }, updatedAt: session.updatedAt }, data: { report: persistedReport as any, updatedAt: nextCunningRevision(session.updatedAt) } })
    })
    if (saved.count !== 1) return NextResponse.json({ error: '生成中にセッションが更新されたか、別の議事録生成が開始されました。最新の内容を確認して再試行してください。', code: 'REPORT_CONFLICT' }, { status: 409 })
    return NextResponse.json({ report: persistedReport, reportStatus: cunningReportStatus(persistedReport, snapshot.fingerprint) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[cunning/report] processing failed')
    return NextResponse.json({ error: '議事録の生成に失敗しました' }, { status: 500 })
  }
}
