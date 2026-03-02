// ============================================
// POST /api/voice/generate-batch — バッチ一括生成
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

const MAX_BATCH = 20

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
        { success: false, error: 'バッチ生成はPROプランが必要です' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { items, speakerId = 'akira', speed = 1.0, pitch = 0, volume = 100, outputFormat = 'mp3' } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'テキストリストを指定してください' }, { status: 400 })
    }
    if (items.length > MAX_BATCH) {
      return NextResponse.json(
        { success: false, error: `バッチ生成は最大${MAX_BATCH}件までです` },
        { status: 400 }
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
      if (used + items.length > monthlyLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `月次制限を超えます（残り${monthlyLimit - used}回 / リクエスト${items.length}件）`,
            code: 'MONTHLY_LIMIT',
          },
          { status: 429 }
        )
      }
    }

    const speaker = getSpeakerById(speakerId)
    if (!speaker) {
      return NextResponse.json({ success: false, error: 'スピーカーが見つかりません' }, { status: 400 })
    }

    const charLimit = getVoiceCharLimitByUserPlan(plan)
    const speedNum = Math.min(2.0, Math.max(0.5, Number(speed) || 1.0))
    const pitchNum = Math.min(10, Math.max(-10, Number(pitch) || 0))
    const volumeNum = Math.min(100, Math.max(0, Number(volume) || 100))

    const results: Array<{ index: number; success: boolean; audioBase64?: string; durationMs?: number; error?: string; projectId?: string }> = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const text = typeof item === 'string' ? item : item?.text
      const label = typeof item === 'object' ? item?.label : null

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        results.push({ index: i, success: false, error: 'テキストが空です' })
        continue
      }

      const { valid, charCount } = validateTextLength(text.trim(), charLimit)
      if (!valid) {
        results.push({ index: i, success: false, error: `文字数超過（${charCount}文字 / 上限${charLimit}文字）` })
        continue
      }

      try {
        const ssml = textToSsml({ text: text.trim(), speed: speedNum, pitch: pitchNum, pauseLength: 'standard', emotionTone: 'neutral' })
        const ttsResult = await generateSpeech({
          text: text.trim(),
          ssml,
          speakerId,
          voiceId: speaker.voiceId,
          speed: speedNum,
          pitch: pitchNum,
          volume: volumeNum,
          outputFormat,
        })

        const project = await prisma.voiceProject.create({
          data: {
            userId: user.id,
            name: label ? String(label).slice(0, 100) : `バッチ${i + 1} ${new Date().toLocaleDateString('ja-JP')}`,
            status: 'completed',
            speakerId,
            speed: speedNum,
            pitch: pitchNum,
            volume: volumeNum,
            inputText: text.trim(),
            ssml,
            outputFormat,
            durationMs: ttsResult.durationMs,
            fileSize: ttsResult.fileSize,
          },
        })

        results.push({
          index: i,
          success: true,
          audioBase64: ttsResult.audioBase64,
          durationMs: ttsResult.durationMs,
          projectId: project.id,
        })
      } catch (e: any) {
        results.push({ index: i, success: false, error: e?.message || '生成エラー' })
      }
    }

    const successCount = results.filter((r) => r.success).length

    return NextResponse.json({
      success: true,
      results,
      successCount,
      failCount: results.length - successCount,
    })
  } catch (error) {
    console.error('Voice generate-batch API error:', error)
    return NextResponse.json(
      { success: false, error: 'バッチ生成に失敗しました' },
      { status: 500 }
    )
  }
}
