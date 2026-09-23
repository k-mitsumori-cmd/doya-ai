// ============================================
// POST /api/interview/materials/[id]/transcribe
// ============================================
// 文字起こしを開始する
// 大容量ファイルも URL ベースで処理するため
// Vercel のメモリ・タイムアウト制限を回避

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5分 (Vercel Pro) — AssemblyAI のポーリングもこの時間内で完了する必要あり。長尺ファイルはタイムアウトの可能性あり

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'
import { transcribeFromUrl, transcribeExistingJob, InterviewTranscriptionTerminalError } from '@/lib/interview/transcription'
import { getInterviewGuestLimits } from '@/lib/pricing'
import { inspectInterviewMediaDuration } from '@/lib/interview/media-duration'
import { reserveInterviewTranscription, settleInterviewTranscription, releaseInterviewTranscription } from '@/lib/interview/transcription-budget'

type Ctx = { params: Promise<{ id: string }> }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = await ctx.params
  return p.id
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  const materialId = await resolveId(ctx)

  try {
    const { userId, plan } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    // 素材取得
    const material = await prisma.interviewMaterial.findUnique({
      where: { id: materialId },
      include: { project: { select: { id: true, userId: true, guestId: true } } },
    })

    if (!material) {
      return NextResponse.json({ success: false, error: '素材が見つかりません' }, { status: 404 })
    }

    const ownerErr = checkOwnership(material.project, userId, guestId)
    if (ownerErr) return ownerErr

    // 音声/動画のみ文字起こし可能
    if (material.type !== 'audio' && material.type !== 'video') {
      return NextResponse.json(
        { success: false, error: '文字起こしは音声・動画ファイルのみ対応しています' },
        { status: 400 }
      )
    }

    if (!material.filePath) {
      return NextResponse.json(
        { success: false, error: 'ファイルがアップロードされていません' },
        { status: 400 }
      )
    }

    const quotaEnabled = process.env.INTERVIEW_TRANSCRIPTION_QUOTA_ENABLED === '1'
    // 既に処理中なら同じ処理に戻る。再接続で利用枠を二重に取らない。
    const existingProcessing = await prisma.interviewTranscription.findFirst({
      where: { materialId, status: 'PROCESSING' },
    })
    if (existingProcessing && !quotaEnabled) {
      return NextResponse.json({
        success: true,
        transcriptionId: existingProcessing.id,
        status: 'PROCESSING',
        message: '文字起こしは既に処理中です',
      })
    }

    let reserved = false
    let transcription: { id: string } | undefined
    let resumeJobId: string | null = null
    let submissionMarker: string | null = null
    if (quotaEnabled) {
      let mediaSeconds: number
      try {
        mediaSeconds = await inspectInterviewMediaDuration(material.filePath, material.fileSize)
      } catch {
        return NextResponse.json({ success: false, error: '音声の長さを確認できません。対応形式のファイルで再試行してください。', code: 'MEDIA_DURATION_UNAVAILABLE' }, { status: 422 })
      }
      const admission = await reserveInterviewTranscription({ userId, guestId, plan }, { id: materialId, projectId: material.project.id }, mediaSeconds)
      if (admission.state === 'limit') {
        return NextResponse.json({ success: false, error: `今月の文字起こし残り時間を超えるファイルです。`, code: 'TRANSCRIPTION_LIMIT', limitExceeded: true, actionUrl: '/interview/pricing', usedMinutes: Math.ceil(admission.usedSeconds / 60), limitMinutes: Math.ceil(admission.limitSeconds / 60) }, { status: 429 })
      }
      if (admission.state === 'too-long') {
        return NextResponse.json({ success: false, error: `1回の文字起こしは${Math.ceil(admission.maxSeconds / 60)}分までです。`, code: 'TRANSCRIPTION_TOO_LONG' }, { status: 400 })
      }
      if (admission.state === 'unavailable') {
        return NextResponse.json({ success: false, error: '文字起こしの利用状況を確認できません。しばらくしてから再試行してください。' }, { status: 503 })
      }
      if (admission.state === 'completed') {
        return NextResponse.json({ success: true, transcriptionId: admission.transcriptionId, status: 'COMPLETED' })
      }
      transcription = { id: admission.transcriptionId }
      reserved = true
      if (admission.state === 'processing' && admission.externalJobId?.startsWith('submitting:')) {
        return NextResponse.json({ success: false, code: 'TRANSCRIPTION_SUBMISSION_UNKNOWN',
          error: '送信状態を確認できません。サポートにお問い合わせください。' }, { status: 503 })
      }
      resumeJobId = admission.state === 'processing' ? admission.externalJobId || null : null
      if (!resumeJobId) {
        // Claim the submission step so the POST and SSE entrypoints cannot create two provider jobs.
        submissionMarker = `submitting:${randomUUID()}`
        const claimed = await prisma.interviewTranscription.updateMany({
          where: { id: transcription.id, status: 'PROCESSING', externalJobId: null },
          data: { externalJobId: submissionMarker },
        })
        if (claimed.count !== 1) {
          return NextResponse.json({ success: true, transcriptionId: transcription.id, status: 'PROCESSING' })
        }
      }
    } else if (!userId && guestId) {
      // 旧処理経路。新しい利用台帳の本番検証が終わるまで維持する。
      const guestLimits = getInterviewGuestLimits()
      const limitSeconds = guestLimits.transcriptionMinutes * 60 // 5分 = 300秒

      // ゲストの合計使用秒数を集計
      const guestUsage = await prisma.interviewMaterial.aggregate({
        _sum: { duration: true },
        where: {
          project: { guestId },
          status: 'COMPLETED',
        },
      })
      const usedSeconds = guestUsage._sum.duration || 0

      if (usedSeconds >= limitSeconds) {
        return NextResponse.json({
          success: false,
          error: `ゲストユーザーは合計${guestLimits.transcriptionMinutes}分までの文字起こしが可能です。無料登録で月${30}分に拡大できます。`,
          limitExceeded: true,
          usedMinutes: Math.ceil(usedSeconds / 60),
          limitMinutes: guestLimits.transcriptionMinutes,
        }, { status: 403 })
      }
    }

    if (!quotaEnabled) {
      // 過去のERROR文字起こしを削除（リトライ可能にする）
      await prisma.interviewTranscription.deleteMany({ where: { materialId, status: 'ERROR' } })
      transcription = await prisma.interviewTranscription.create({
        data: { projectId: material.project.id, materialId: material.id, text: '', status: 'PROCESSING', provider: null },
      })
      await prisma.interviewMaterial.update({ where: { id: materialId }, data: { status: 'PROCESSING' } })
    }
    if (!transcription) throw new Error('Transcription start unavailable')

    // リクエストボディからオプション取得
    let language: string | undefined
    try {
      const body = await req.json()
      language = body?.language
    } catch {
      // body が空の場合は無視
    }

    // 文字起こし実行 (URL ベース — Vercel はファイルに触れない)
    let submitStarted = false
    try {
      const result = resumeJobId ? await transcribeExistingJob(resumeJobId, 210_000) : await transcribeFromUrl({
        storagePath: material.filePath,
        mimeType: material.mimeType || 'audio/mpeg',
        fileSize: Number(material.fileSize || 0),
        language,
        ...(reserved ? { maxWaitMs: 210_000 } : {}),
        ...(reserved ? {
          onBeforeSubmit: () => { submitStarted = true },
          onJobSubmitted: async (jobId: string) => {
            const saved = await prisma.interviewTranscription.updateMany({
              where: { id: transcription.id, status: 'PROCESSING', externalJobId: submissionMarker },
              data: { externalJobId: jobId },
            })
            if (saved.count !== 1) throw new Error('Transcription job ID persistence failed')
            resumeJobId = jobId
          },
        } : {}),
      })

      // duration計算: segmentsの最後のendか、AssemblyAIのaudio_durationから取得
      let durationSeconds = 0
      if (result.segments && result.segments.length > 0) {
        durationSeconds = Math.ceil(result.segments[result.segments.length - 1].end)
      }

      // 結果を保存
      await prisma.$transaction(async tx => {
        if (reserved) await settleInterviewTranscription(tx, materialId, transcription.id)
        await tx.interviewTranscription.update({
          where: { id: transcription.id },
          data: { text: result.text, segments: result.segments as any, summary: result.summary,
            provider: result.provider, confidence: result.confidence, status: 'COMPLETED' },
        })
        await tx.interviewMaterial.update({
          where: { id: materialId }, data: { status: 'COMPLETED', duration: durationSeconds > 0 ? durationSeconds : null },
        })
        await tx.interviewProject.update({ where: { id: material.project.id }, data: { status: 'EDITING' } })
      })

      const durationMinutes = durationSeconds > 0 ? Math.ceil(durationSeconds / 60) : null

      return NextResponse.json({
        success: true,
        transcriptionId: transcription.id,
        status: 'COMPLETED',
        text: result.text.slice(0, 500) + (result.text.length > 500 ? '...' : ''),
        provider: result.provider,
        segmentCount: result.segments.length,
        durationSeconds,
        durationMinutes,
      })
    } catch (transcribeError: any) {
      // 文字起こし失敗
      console.error('[interview] Transcription failed')

      if (reserved) {
        const saved = await prisma.interviewTranscription.findUnique({
          where: { id: transcription.id }, select: { status: true, externalJobId: true },
        }).catch(() => null)
        if (saved?.status === 'COMPLETED') {
          return NextResponse.json({ success: true, transcriptionId: transcription.id, status: 'COMPLETED' })
        }
        if (!(transcribeError instanceof InterviewTranscriptionTerminalError)) {
          if (saved?.externalJobId && !saved.externalJobId.startsWith('submitting:')) {
            return NextResponse.json({ success: true, transcriptionId: transcription.id, status: 'PROCESSING',
              resumeUrl: `/interview/projects/${material.project.id}/transcribe?materialId=${materialId}` })
          }
          if (submitStarted) {
            return NextResponse.json({ success: false, code: 'TRANSCRIPTION_SUBMISSION_UNKNOWN',
              error: '送信状態を確認できません。サポートにお問い合わせください。' }, { status: 503 })
          }
        }
      }

      const markedError = await prisma.$transaction(async tx => {
        if (reserved) {
          await releaseInterviewTranscription(tx, materialId, transcription.id)
          const changed = await tx.interviewTranscription.updateMany({
            where: { id: transcription.id, status: 'PROCESSING' }, data: { status: 'ERROR' },
          })
          if (!changed.count) return false
          await tx.interviewMaterial.updateMany({
            where: { id: materialId, status: 'PROCESSING' },
            data: { status: 'ERROR', error: '文字起こしに失敗しました。時間をおいて再試行してください。' },
          })
          return true
        }
        await tx.interviewTranscription.update({ where: { id: transcription.id }, data: { status: 'ERROR' } })
        await tx.interviewMaterial.update({ where: { id: materialId }, data: { status: 'ERROR', error: '文字起こしに失敗しました。時間をおいて再試行してください。' } })
        return true
      })
      if (!markedError && reserved) {
        const latest = await prisma.interviewTranscription.findUnique({
          where: { id: transcription.id }, select: { status: true },
        }).catch(() => null)
        if (latest?.status === 'COMPLETED') {
          return NextResponse.json({ success: true, transcriptionId: transcription.id, status: 'COMPLETED' })
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: '文字起こしに失敗しました。時間をおいて再試行してください。',
          transcriptionId: transcription.id,
          hint: getErrorHint(transcribeError),
        },
        { status: 500 }
      )
    }
  } catch (e: any) {
    console.error('[interview] transcribe error')
    return NextResponse.json(
      { success: false, error: '文字起こしの開始に失敗しました。時間をおいて再試行してください。' },
      { status: 500 }
    )
  }
}

function getErrorHint(e: any): string | undefined {
  const m = String(e?.message || '')
  if (/OPENAI_API_KEY/i.test(m)) {
    return 'OPENAI_API_KEY を環境変数に設定してください'
  }
  if (/GOOGLE_SPEECH/i.test(m)) {
    return 'INTERVIEW_GOOGLE_SPEECH_API_KEY を環境変数に設定してください'
  }
  if (/ASSEMBLYAI/i.test(m)) {
    return 'ASSEMBLYAI_API_KEY を環境変数に設定してください'
  }
  if (/タイムアウト/i.test(m)) {
    return 'ファイルが大きすぎる可能性があります。短い音声から試してください。'
  }
  return undefined
}
