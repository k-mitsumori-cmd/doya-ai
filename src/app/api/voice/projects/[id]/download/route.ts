// ============================================
// GET /api/voice/projects/[id]/download — 音声ダウンロード
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getSpeakerById } from '@/lib/voice/speakers'
import { generateSpeech } from '@/lib/voice/tts'
import { textToSsml } from '@/lib/voice/ssml'

const MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    const project = await prisma.voiceProject.findFirst({
      where: { id: params.id, userId: user.id },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    let audioBase64: string

    // outputUrlがあればそこから取得、なければ再生成
    if (project.outputUrl) {
      const res = await fetch(project.outputUrl)
      if (!res.ok) throw new Error('音声ファイルの取得に失敗しました')
      const buffer = await res.arrayBuffer()
      audioBase64 = Buffer.from(buffer).toString('base64')
    } else {
      const speaker = getSpeakerById(project.speakerId)
      if (!speaker) {
        return NextResponse.json({ success: false, error: 'スピーカーが見つかりません' }, { status: 400 })
      }

      const ssml = project.ssml || textToSsml({
        text: project.inputText,
        speed: project.speed,
        pitch: project.pitch,
        pauseLength: (project.pauseLength as any) || 'standard',
        emotionTone: (project.emotionTone as any) || 'neutral',
      })

      const result = await generateSpeech({
        text: project.inputText,
        ssml,
        speakerId: project.speakerId,
        voiceId: speaker.voiceId,
        speed: project.speed,
        pitch: project.pitch,
        volume: project.volume,
        outputFormat: project.outputFormat as any,
      })
      audioBase64 = result.audioBase64
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64')
    const mimeType = MIME_MAP[project.outputFormat] || 'audio/mpeg'
    const filename = `${project.name.replace(/[^a-zA-Z0-9ぁ-んァ-ン一-龥]/g, '_')}.${project.outputFormat}`

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(audioBuffer.length),
      },
    })
  } catch (error) {
    console.error('Voice download API error:', error)
    return NextResponse.json(
      { success: false, error: 'ダウンロードに失敗しました' },
      { status: 500 }
    )
  }
}
