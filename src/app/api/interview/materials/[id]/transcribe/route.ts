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
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'
import { transcribeFromUrl } from '@/lib/interview/transcription'
import { getInterviewGuestLimits } from '@/lib/pricing'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  const materialId = await resolveId(ctx)

  try {
    const { userId } = await getInterviewUser()
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

    // ゲストユーザーの文字起こし上限チェック
    if (!userId && guestId) {
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

    // 既に処理中の文字起こしがあるかチェック
    const existingProcessing = await prisma.interviewTranscription.findFirst({
      where: {
        materialId,
        status: 'PROCESSING',
      },
    })

    if (existingProcessing) {
      return NextResponse.json({
        success: true,
        transcriptionId: existingProcessing.id,
        status: 'PROCESSING',
        message: '文字起こしは既に処理中です',
      })
    }

    // 過去のERROR文字起こしを削除（リトライ可能にする）
    await prisma.interviewTranscription.deleteMany({
      where: { materialId, status: 'ERROR' },
    })

    // 文字起こしレコードを先に作成 (PROCESSING)
    const transcription = await prisma.interviewTranscription.create({
      data: {
        projectId: material.project.id,
        materialId: material.id,
        text: '',
        status: 'PROCESSING',
        provider: null,
      },
    })

    // 素材ステータスも更新
    await prisma.interviewMaterial.update({
      where: { id: materialId },
      data: { status: 'PROCESSING' },
    })

    // リクエストボディからオプション取得
    let language: string | undefined
    try {
      const body = await req.json()
      language = body?.language
    } catch {
      // body が空の場合は無視
    }

    // 文字起こし実行 (URL ベース — Vercel はファイルに触れない)
    try {
      const result = await transcribeFromUrl({
        storagePath: material.filePath,
        mimeType: material.mimeType || 'audio/mpeg',
        fileSize: Number(material.fileSize || 0),
        language,
      })

      // duration計算: segmentsの最後のendか、AssemblyAIのaudio_durationから取得
      let durationSeconds = 0
      if (result.segments && result.segments.length > 0) {
        durationSeconds = Math.ceil(result.segments[result.segments.length - 1].end)
      }

      // 結果を保存
      await prisma.interviewTranscription.update({
        where: { id: transcription.id },
        data: {
          text: result.text,
          segments: result.segments as any,
          summary: result.summary,
          provider: result.provider,
          confidence: result.confidence,
          status: 'COMPLETED',
        },
      })

      await prisma.interviewMaterial.update({
        where: { id: materialId },
        data: {
          status: 'COMPLETED',
          duration: durationSeconds > 0 ? durationSeconds : null,
        },
      })

      // プロジェクトステータスも更新
      await prisma.interviewProject.update({
        where: { id: material.project.id },
        data: { status: 'EDITING' },
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
      console.error('[interview] Transcription failed:', transcribeError?.message)

      await prisma.interviewTranscription.update({
        where: { id: transcription.id },
        data: { status: 'ERROR' },
      })

      await prisma.interviewMaterial.update({
        where: { id: materialId },
        data: {
          status: 'ERROR',
          error: transcribeError?.message || '文字起こしに失敗しました',
        },
      })

      return NextResponse.json(
        {
          success: false,
          error: transcribeError?.message || '文字起こしに失敗しました',
          transcriptionId: transcription.id,
          hint: getErrorHint(transcribeError),
        },
        { status: 500 }
      )
    }
  } catch (e: any) {
    console.error('[interview] transcribe error:', e?.message)
    return NextResponse.json(
      { success: false, error: e?.message || '文字起こしの開始に失敗しました' },
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
