// ============================================
// POST /api/voice/merge — AI音声 + 録音合成
// ============================================
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
import { getVoiceMonthlyLimitByUserPlan } from '@/lib/pricing'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    const plan = String(user?.voicePlan || user?.plan || 'FREE').toUpperCase()
    const isPro = ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(plan)

    if (!isPro) {
      return NextResponse.json(
        { success: false, error: 'AI音声合成はPROプランが必要です' },
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
      recordingId,
      mergeMode = 'concat', // 'concat' | 'overlay'
    } = body

    if (!text && !projectId) {
      return NextResponse.json({ success: false, error: 'テキストまたはプロジェクトIDを指定してください' }, { status: 400 })
    }

    // 月次利用制限チェック
    const monthlyLimit = getVoiceMonthlyLimitByUserPlan(plan)
    if (monthlyLimit >= 0) {
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
      })
      if (!project) {
        return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
      }
      inputText = project.inputText
    }

    // 録音データ確認
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

    // スピーカー確認
    const speaker = getSpeakerById(speakerId)
    if (!speaker) {
      return NextResponse.json({ success: false, error: 'スピーカーが見つかりません' }, { status: 400 })
    }

    const speedNum = Math.min(2.0, Math.max(0.5, Number(speed) || 1.0))
    const pitchNum = Math.min(10, Math.max(-10, Number(pitch) || 0))
    const volumeNum = Math.min(100, Math.max(0, Number(volume) || 100))

    // AI音声生成
    const ssml = textToSsml({ text: inputText, speed: speedNum, pitch: pitchNum, pauseLength: 'standard', emotionTone: 'neutral' })
    const ttsResult = await generateSpeech({
      text: inputText,
      ssml,
      speakerId,
      voiceId: speaker.voiceId,
      speed: speedNum,
      pitch: pitchNum,
      volume: volumeNum,
      outputFormat: 'mp3',
    })

    // プロジェクト更新または新規作成
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
          ssml,
          durationMs: ttsResult.durationMs,
          fileSize: ttsResult.fileSize,
          metadata: { mergeMode, recordingId: recordingId || null } as any,
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
          inputText: inputText.slice(0, 5000),
          ssml,
          outputFormat: 'mp3',
          durationMs: ttsResult.durationMs,
          fileSize: ttsResult.fileSize,
          metadata: { mergeMode, recordingId: recordingId || null } as any,
        },
      })
    }

    return NextResponse.json({
      success: true,
      projectId: savedProject.id,
      aiAudioBase64: ttsResult.audioBase64,
      aiDurationMs: ttsResult.durationMs,
      recordingUrl: recording ? (recording.trimmedUrl || recording.originalUrl) : null,
      recordingDurationMs: recording?.durationMs || null,
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
