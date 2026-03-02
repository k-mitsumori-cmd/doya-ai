// ============================================
// POST /api/voice/generate — テキスト→音声生成
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getSpeakerById } from '@/lib/voice/speakers'
import { generateSpeech, validateTextLength } from '@/lib/voice/tts'
import { textToSsml } from '@/lib/voice/ssml'
import { getVoiceMonthlyLimitByUserPlan, getVoiceCharLimitByUserPlan } from '@/lib/pricing'

const VALID_FORMATS = ['mp3', 'wav', 'ogg', 'm4a'] as const
const VALID_EMOTIONS = ['neutral', 'bright', 'calm', 'serious', 'gentle'] as const
const VALID_PAUSES = ['short', 'standard', 'long', 'custom'] as const

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: '音声生成にはログインが必要です' }, { status: 401 })
    }

    const plan = String(user?.voicePlan || user?.plan || 'FREE').toUpperCase()
    const isPro = ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(plan)

    // 月次利用制限チェック
    const monthlyLimit = getVoiceMonthlyLimitByUserPlan(plan)
    if (monthlyLimit >= 0) {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const used = await prisma.voiceProject.count({
        where: {
          userId: user.id,
          status: 'completed',
          createdAt: { gte: monthStart },
        },
      })
      if (used >= monthlyLimit) {
        return NextResponse.json(
          { success: false, error: `今月の生成回数上限（${monthlyLimit}回）に達しました`, code: 'MONTHLY_LIMIT' },
          { status: 429 }
        )
      }
    }

    const body = await req.json()
    const {
      text,
      speakerId = 'akira',
      speed = 1.0,
      pitch = 0,
      volume = 100,
      outputFormat = 'mp3',
      emotionTone = 'neutral',
      pauseLength = 'standard',
      projectName,
      saveProject = true,
      projectId: existingProjectId,   // 再生成時に既存プロジェクトを上書き
    } = body

    // バリデーション
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'テキストを入力してください' }, { status: 400 })
    }

    const charLimit = getVoiceCharLimitByUserPlan(plan)
    const { valid, charCount } = validateTextLength(text.trim(), charLimit)
    if (!valid) {
      return NextResponse.json(
        { success: false, error: `テキストが長すぎます（${charCount}文字 / 上限${charLimit}文字）` },
        { status: 400 }
      )
    }

    if (!VALID_FORMATS.includes(outputFormat)) {
      return NextResponse.json({ success: false, error: '不正な出力形式です' }, { status: 400 })
    }
    if (!VALID_EMOTIONS.includes(emotionTone)) {
      return NextResponse.json({ success: false, error: '不正な感情トーンです' }, { status: 400 })
    }
    if (!VALID_PAUSES.includes(pauseLength)) {
      return NextResponse.json({ success: false, error: '不正なポーズ長です' }, { status: 400 })
    }

    // PRO限定フォーマットチェック
    if (!isPro && outputFormat !== 'mp3') {
      return NextResponse.json(
        { success: false, error: 'MP3以外の形式はPROプランが必要です' },
        { status: 403 }
      )
    }

    const speaker = getSpeakerById(speakerId)
    if (!speaker) {
      return NextResponse.json({ success: false, error: 'スピーカーが見つかりません' }, { status: 400 })
    }

    if (speaker.isPro && !isPro) {
      return NextResponse.json(
        { success: false, error: 'このスピーカーはPROプランが必要です' },
        { status: 403 }
      )
    }

    const speedNum = Math.min(2.0, Math.max(0.5, Number(speed) || 1.0))
    const pitchNum = Math.min(10, Math.max(-10, Number(pitch) || 0))
    const volumeNum = Math.min(100, Math.max(0, Number(volume) || 100))

    // SSML変換（感情トーンとポーズを適用）
    const ssml = textToSsml({
      text: text.trim(),
      speed: speedNum,
      pitch: pitchNum,
      emotionTone,
      pauseLength,
    })

    // 音声生成
    const result = await generateSpeech({
      text: text.trim(),
      ssml,
      speakerId,
      voiceId: speaker.voiceId,
      speed: speedNum,
      pitch: pitchNum,
      volume: volumeNum,
      outputFormat,
      emotionTone,
    })

    // プロジェクト保存（saveProject=trueのとき）
    let projectId: string | null = existingProjectId || null
    if (saveProject) {
      const projectData = {
        status: 'completed',
        speakerId,
        speed: speedNum,
        pitch: pitchNum,
        volume: volumeNum,
        pauseLength,
        emotionTone,
        inputText: text.trim(),
        ssml,
        outputFormat,
        durationMs: result.durationMs,
        fileSize: result.fileSize,
      }
      // 既存プロジェクトIDがあれば更新、なければ新規作成
      if (existingProjectId) {
        const existing = await prisma.voiceProject.findFirst({
          where: { id: existingProjectId, userId: user.id },
        })
        if (existing) {
          await prisma.voiceProject.update({ where: { id: existingProjectId }, data: projectData })
        } else {
          projectId = null // 不正なIDは無視
        }
      } else {
        const project = await prisma.voiceProject.create({
          data: {
            userId: user.id,
            name: projectName ? String(projectName).slice(0, 100) : `ナレーション ${new Date().toLocaleDateString('ja-JP')}`,
            ...projectData,
          },
        })
        projectId = project.id
      }
    }

    return NextResponse.json({
      success: true,
      audioBase64: result.audioBase64,
      durationMs: result.durationMs,
      fileSize: result.fileSize,
      format: result.format,
      projectId,
      charCount,
    })
  } catch (error) {
    console.error('Voice generate API error:', error)
    return NextResponse.json(
      { success: false, error: '音声生成に失敗しました' },
      { status: 500 }
    )
  }
}
