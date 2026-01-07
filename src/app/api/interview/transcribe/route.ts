import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { join } from 'path'

// 文字起こし実行（音声・動画ファイルから）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { materialId, projectId } = body

    if (!materialId || !projectId) {
      return NextResponse.json({ error: 'Missing materialId or projectId' }, { status: 400 })
    }

    // 素材取得
    const material = await prisma.interviewMaterial.findFirst({
      where: {
        id: materialId,
        projectId,
      },
    })

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    if (material.type !== 'audio' && material.type !== 'video') {
      return NextResponse.json({ error: 'Only audio/video files can be transcribed' }, { status: 400 })
    }

    // TODO: 実際の文字起こしAPI連携（Google Speech-to-Text, Whisper等）
    // 現在はプレースホルダー
    const transcriptionText = `[文字起こし機能は実装中です]
素材ファイル: ${material.fileName}
タイプ: ${material.type}
サイズ: ${material.fileSize} bytes

実際の実装では、以下のAPIを使用します：
- Google Speech-to-Text API
- OpenAI Whisper API
- Deepgram API
など`

    // 文字起こし結果を保存
    const transcription = await prisma.interviewTranscription.create({
      data: {
        projectId,
        materialId,
        text: transcriptionText,
        provider: 'manual', // TODO: 実際のプロバイダー名に変更
      },
    })

    // 素材のステータスを更新
    await prisma.interviewMaterial.update({
      where: { id: materialId },
      data: { status: 'COMPLETED' },
    })

    return NextResponse.json({ transcription })
  } catch (error) {
    console.error('[INTERVIEW] Transcription error:', error)
    return NextResponse.json({ error: 'Failed to transcribe' }, { status: 500 })
  }
}

