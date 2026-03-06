// ============================================
// GET / POST /api/voice/merge — AI音声 + 録音合成
// ============================================
// GET:  プロジェクトに紐づく録音一覧と合成情報を取得
// POST: AI音声を生成し、録音との合成順序・タイミングを生成してメタデータに保存
//
// 注: サーバーサイドでのAudio合成は複雑なため、
//     このAPIではメタデータを記録し、クライアント側合成をサポートする
//     将来的にはffmpegを使った完全サーバーサイド合成に移行

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getSpeakerById } from '@/lib/voice/speakers'
import { generateSpeech } from '@/lib/voice/tts'
import { textToSsml } from '@/lib/voice/ssml'
import { getVoiceMonthlyLimitByUserPlan, isWithinFreeHour } from '@/lib/pricing'

interface MergeTrackItem {
  type: 'ai' | 'recording'
  id: string
  order: number
  label: string | null
  url: string | null
  durationMs: number
  startOffsetMs: number
}

interface MergeTimeline {
  totalDurationMs: number
  mergeMode: string
  tracks: MergeTrackItem[]
}

/**
 * GET — プロジェクトに紐づく録音一覧と合成タイムライン情報を取得
 * query: ?projectId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    const projectId = req.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectIdは必須です' }, { status: 400 })
    }

    const project = await prisma.voiceProject.findFirst({
      where: { id: projectId, userId: user.id },
      include: {
        recordings: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    // メタデータから保存済みの合成情報を復元
    const metadata = (project.metadata as any) || {}
    const mergeMode = metadata.mergeMode || 'concat'

    // タイムライン構築
    const tracks: MergeTrackItem[] = []
    let currentOffsetMs = 0

    // AI音声トラック（プロジェクト自体が持つTTS音声）
    if (project.status === 'completed' && project.durationMs) {
      tracks.push({
        type: 'ai',
        id: project.id,
        order: 0,
        label: 'AI音声',
        url: `/api/voice/projects/${project.id}/download`,
        durationMs: project.durationMs as number,
        startOffsetMs: currentOffsetMs,
      })
      if (mergeMode === 'concat') {
        currentOffsetMs += project.durationMs as number
      }
    }

    // 録音トラック
    for (const rec of project.recordings) {
      tracks.push({
        type: 'recording',
        id: rec.id,
        order: rec.order + 1,
        label: rec.label || `録音 ${rec.order + 1}`,
        url: rec.trimmedUrl || rec.originalUrl,
        durationMs: rec.durationMs || 0,
        startOffsetMs: mergeMode === 'overlay' ? 0 : currentOffsetMs,
      })
      if (mergeMode === 'concat') {
        currentOffsetMs += rec.durationMs || 0
      }
    }

    // overlay モードの場合、最長トラックが全体長さ
    const totalDurationMs = mergeMode === 'overlay'
      ? Math.max(...tracks.map(t => t.durationMs), 0)
      : currentOffsetMs

    const timeline: MergeTimeline = {
      totalDurationMs,
      mergeMode,
      tracks,
    }

    return NextResponse.json({
      success: true,
      projectId: project.id,
      projectName: project.name,
      status: project.status,
      recordings: project.recordings.map(r => ({
        id: r.id,
        label: r.label,
        originalUrl: r.originalUrl,
        trimmedUrl: r.trimmedUrl,
        durationMs: r.durationMs,
        fileSize: r.fileSize,
        format: r.format,
        order: r.order,
        createdAt: r.createdAt.toISOString(),
      })),
      timeline,
    })
  } catch (error) {
    console.error('Voice merge GET error:', error)
    return NextResponse.json(
      { success: false, error: '合成情報の取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * POST — AI音声を生成し、録音との合成順序・タイミングをメタデータに保存
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    const plan = String(user?.voicePlan || user?.plan || 'FREE').toUpperCase()
    const isPro = ['PRO', 'LIGHT', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(plan)

    if (!isPro) {
      return NextResponse.json(
        { success: false, error: 'AI音声合成は上位プランが必要です' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const {
      projectId,
      text,
      speakerId = 'akira',
      speed = 1.0,
      pitch = 0,
      volume = 100,
      emotionTone = 'neutral',
      pauseLength = 'standard',
      recordingId,
      recordingIds,       // 複数録音を指定可能
      mergeMode = 'concat', // 'concat' | 'overlay'
      trackOrder,           // カスタム順序: [{ type, id, order }]
    } = body

    if (!text && !projectId) {
      return NextResponse.json({ success: false, error: 'テキストまたはプロジェクトIDを指定してください' }, { status: 400 })
    }

    // フリーアワー判定
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { firstLoginAt: true },
    })
    const isFreeHour = dbUser ? isWithinFreeHour(dbUser.firstLoginAt) : false

    // 月次利用制限チェック（フリーアワー中はスキップ）
    const monthlyLimit = getVoiceMonthlyLimitByUserPlan(plan)
    if (!isFreeHour && monthlyLimit >= 0) {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const used = await prisma.voiceProject.count({
        where: { userId: user.id, status: 'completed', createdAt: { gte: monthStart } },
      })
      if (used >= monthlyLimit) {
        return NextResponse.json(
          { success: false, error: `今月の生成回数上限（${monthlyLimit}回）に達しました`, code: 'MONTHLY_LIMIT' },
          { status: 429 }
        )
      }
    }

    let inputText = text
    let project = null

    // プロジェクトからテキスト取得
    if (projectId) {
      project = await prisma.voiceProject.findFirst({
        where: { id: projectId, userId: user.id },
        include: { recordings: { orderBy: { order: 'asc' } } },
      })
      if (!project) {
        return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
      }
      if (!text) {
        inputText = project.inputText
      }
    }

    // 録音データ確認（単一指定）
    let recording = null
    if (recordingId) {
      recording = await prisma.voiceRecording.findFirst({
        where: { id: recordingId },
        include: { project: { select: { userId: true } } },
      })
      if (!recording || recording.project.userId !== user.id) {
        return NextResponse.json({ success: false, error: '録音データが見つかりません' }, { status: 404 })
      }
    }

    // 録音データ確認（複数指定）
    let recordings: any[] = []
    if (recordingIds && Array.isArray(recordingIds) && recordingIds.length > 0) {
      recordings = await prisma.voiceRecording.findMany({
        where: {
          id: { in: recordingIds },
        },
        include: { project: { select: { userId: true } } },
        orderBy: { order: 'asc' },
      })
      // 所有者確認
      const invalidRecs = recordings.filter(r => r.project.userId !== user.id)
      if (invalidRecs.length > 0) {
        return NextResponse.json({ success: false, error: '一部の録音データへのアクセス権がありません' }, { status: 403 })
      }
    } else if (recording) {
      recordings = [recording]
    } else if (project && (project as any).recordings) {
      recordings = (project as any).recordings
    }

    // スピーカー確認
    const speaker = getSpeakerById(speakerId)
    if (!speaker) {
      return NextResponse.json({ success: false, error: 'スピーカーが見つかりません' }, { status: 400 })
    }

    const speedNum = Math.min(2.0, Math.max(0.5, Number(speed) || 1.0))
    const pitchNum = Math.min(10, Math.max(-10, Number(pitch) || 0))
    const volumeNum = Math.min(100, Math.max(0, Number(volume) || 100))

    // AI音声生成
    const ssml = textToSsml({
      text: inputText,
      speed: speedNum,
      pitch: pitchNum,
      pauseLength: pauseLength as any,
      emotionTone: emotionTone as any,
    })
    const ttsResult = await generateSpeech({
      text: inputText,
      ssml,
      speakerId,
      voiceId: speaker.voiceId,
      speed: speedNum,
      pitch: pitchNum,
      volume: volumeNum,
      outputFormat: 'mp3',
      emotionTone: emotionTone as any,
    })

    // タイムライン生成
    const tracks: MergeTrackItem[] = []
    let currentOffsetMs = 0

    // カスタム順序が指定されていればそれに従う
    if (trackOrder && Array.isArray(trackOrder)) {
      for (const item of trackOrder) {
        if (item.type === 'ai') {
          tracks.push({
            type: 'ai',
            id: 'tts',
            order: item.order ?? tracks.length,
            label: 'AI音声',
            url: null,
            durationMs: ttsResult.durationMs,
            startOffsetMs: mergeMode === 'overlay' ? 0 : currentOffsetMs,
          })
          if (mergeMode === 'concat') currentOffsetMs += ttsResult.durationMs
        } else if (item.type === 'recording' && item.id) {
          const rec = recordings.find((r: any) => r.id === item.id)
          if (rec) {
            tracks.push({
              type: 'recording',
              id: rec.id,
              order: item.order ?? tracks.length,
              label: rec.label || null,
              url: rec.trimmedUrl || rec.originalUrl,
              durationMs: rec.durationMs || 0,
              startOffsetMs: mergeMode === 'overlay' ? 0 : currentOffsetMs,
            })
            if (mergeMode === 'concat') currentOffsetMs += rec.durationMs || 0
          }
        }
      }
    } else {
      // デフォルト: AI音声 → 録音の順番で連結
      tracks.push({
        type: 'ai',
        id: 'tts',
        order: 0,
        label: 'AI音声',
        url: null,
        durationMs: ttsResult.durationMs,
        startOffsetMs: mergeMode === 'overlay' ? 0 : currentOffsetMs,
      })
      if (mergeMode === 'concat') currentOffsetMs += ttsResult.durationMs

      for (let i = 0; i < recordings.length; i++) {
        const rec = recordings[i]
        tracks.push({
          type: 'recording',
          id: rec.id,
          order: i + 1,
          label: rec.label || null,
          url: rec.trimmedUrl || rec.originalUrl,
          durationMs: rec.durationMs || 0,
          startOffsetMs: mergeMode === 'overlay' ? 0 : currentOffsetMs,
        })
        if (mergeMode === 'concat') currentOffsetMs += rec.durationMs || 0
      }
    }

    const totalDurationMs = mergeMode === 'overlay'
      ? Math.max(...tracks.map(t => t.durationMs), 0)
      : currentOffsetMs

    const timeline: MergeTimeline = {
      totalDurationMs,
      mergeMode,
      tracks,
    }

    // プロジェクト更新または新規作成（タイムライン情報をメタデータに保存）
    const mergeMetadata = {
      mergeMode,
      recordingId: recordingId || null,
      recordingIds: recordings.map((r: any) => r.id),
      timeline,
      mergedAt: new Date().toISOString(),
    }

    let savedProject
    if (project) {
      savedProject = await prisma.voiceProject.update({
        where: { id: project.id },
        data: {
          status: 'completed',
          speakerId,
          speed: speedNum,
          pitch: pitchNum,
          volume: volumeNum,
          emotionTone,
          pauseLength,
          ssml,
          durationMs: totalDurationMs,
          fileSize: ttsResult.fileSize,
          metadata: mergeMetadata as any,
        },
      })
    } else {
      savedProject = await prisma.voiceProject.create({
        data: {
          userId: user.id,
          name: `合成音声 ${new Date().toLocaleDateString('ja-JP')}`,
          status: 'completed',
          speakerId,
          speed: speedNum,
          pitch: pitchNum,
          volume: volumeNum,
          emotionTone,
          pauseLength,
          inputText: inputText.slice(0, 5000),
          ssml,
          outputFormat: 'mp3',
          durationMs: totalDurationMs,
          fileSize: ttsResult.fileSize,
          metadata: mergeMetadata as any,
        },
      })
    }

    return NextResponse.json({
      success: true,
      projectId: savedProject.id,
      aiAudioBase64: ttsResult.audioBase64,
      aiDurationMs: ttsResult.durationMs,
      recordings: recordings.map((r: any) => ({
        id: r.id,
        label: r.label,
        url: r.trimmedUrl || r.originalUrl,
        durationMs: r.durationMs || 0,
      })),
      timeline,
      mergeMode,
    })
  } catch (error) {
    console.error('Voice merge API error:', error)
    return NextResponse.json(
      { success: false, error: '音声合成に失敗しました' },
      { status: 500 }
    )
  }
}
