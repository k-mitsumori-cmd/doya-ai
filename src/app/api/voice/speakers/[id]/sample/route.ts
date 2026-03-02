// ============================================
// GET /api/voice/speakers/[id]/sample — サンプル音声生成
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSpeakerById } from '@/lib/voice/speakers'
import { generateSpeech } from '@/lib/voice/tts'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    const speaker = getSpeakerById(params.id)
    if (!speaker) {
      return NextResponse.json({ success: false, error: 'スピーカーが見つかりません' }, { status: 404 })
    }

    const isPro = ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(
      String(user?.voicePlan || user?.plan || '').toUpperCase()
    )

    if (speaker.isPro && !isPro) {
      return NextResponse.json(
        { success: false, error: 'このスピーカーはPROプラン限定です' },
        { status: 403 }
      )
    }

    const result = await generateSpeech({
      text: speaker.sampleText,
      speakerId: speaker.id,
      voiceId: speaker.voiceId,
      speed: 1.0,
      pitch: 0,
      volume: 100,
      outputFormat: 'mp3',
    })

    return NextResponse.json({
      success: true,
      audioBase64: result.audioBase64,
      durationMs: result.durationMs,
      format: result.format,
    })
  } catch (error) {
    console.error('Speaker sample API error:', error)
    return NextResponse.json(
      { success: false, error: 'サンプル音声の生成に失敗しました' },
      { status: 500 }
    )
  }
}
