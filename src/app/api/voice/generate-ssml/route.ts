// ============================================
// POST /api/voice/generate-ssml — SSML直接入力による音声生成
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getSpeakerById } from '@/lib/voice/speakers'
import { generateSpeech } from '@/lib/voice/tts'
import { validateSsml } from '@/lib/voice/ssml'
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
        { success: false, error: 'SSML直接入力はPROプランが必要です' },
        { status: 403 }
      )
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

    const body = await req.json()
    const { ssml, speakerId = 'akira', speed = 1.0, pitch = 0, volume = 100, outputFormat = 'mp3', projectName } = body

    if (!ssml || typeof ssml !== 'string' || ssml.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'SSMLを入力してください' }, { status: 400 })
    }

    const validation = validateSsml(ssml)
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
    }

    const speaker = getSpeakerById(speakerId)
    if (!speaker) {
      return NextResponse.json({ success: false, error: 'スピーカーが見つかりません' }, { status: 400 })
    }

    const speedNum = Math.min(2.0, Math.max(0.5, Number(speed) || 1.0))
    const pitchNum = Math.min(10, Math.max(-10, Number(pitch) || 0))
    const volumeNum = Math.min(100, Math.max(0, Number(volume) || 100))

    // SSMLからテキスト抽出（ログ用）
    const plainText = ssml.replace(/<[^>]+>/g, '').trim().slice(0, 500)

    const result = await generateSpeech({
      text: plainText,
      ssml: ssml.trim(),
      speakerId,
      voiceId: speaker.voiceId,
      speed: speedNum,
      pitch: pitchNum,
      volume: volumeNum,
      outputFormat,
    })

    // プロジェクト保存
    const project = await prisma.voiceProject.create({
      data: {
        userId: user.id,
        name: projectName ? String(projectName).slice(0, 100) : `SSML生成 ${new Date().toLocaleDateString('ja-JP')}`,
        status: 'completed',
        speakerId,
        speed: speedNum,
        pitch: pitchNum,
        volume: volumeNum,
        inputText: plainText,
        ssml: ssml.trim(),
        outputFormat,
        durationMs: result.durationMs,
        fileSize: result.fileSize,
      },
    })

    return NextResponse.json({
      success: true,
      audioBase64: result.audioBase64,
      durationMs: result.durationMs,
      fileSize: result.fileSize,
      format: result.format,
      projectId: project.id,
    })
  } catch (error) {
    console.error('Voice generate-ssml API error:', error)
    return NextResponse.json(
      { success: false, error: 'SSML音声生成に失敗しました' },
      { status: 500 }
    )
  }
}
