import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { transcriptionId: string } }
) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    const { transcriptionId } = params

    if (!transcriptionId) {
      return NextResponse.json(
        { error: 'transcriptionIdが必要です' },
        { status: 400 }
      )
    }

    // 文字起こしを取得
    const transcription = await prisma.interviewTranscription.findFirst({
      where: {
        id: transcriptionId,
        OR: [
          { project: { userId: userId || undefined } },
          { project: { guestId: guestId || undefined } },
        ],
      },
      include: {
        material: true,
      },
    })

    if (!transcription) {
      return NextResponse.json(
        { error: '文字起こしが見つかりません' },
        { status: 404 }
      )
    }

    // materialが含まれている場合、fileSizeを文字列に変換
    const materialResponse = transcription.material ? {
      ...transcription.material,
      fileSize: transcription.material.fileSize ? transcription.material.fileSize.toString() : null,
    } : null

    return NextResponse.json({
      id: transcription.id,
      status: transcription.status,
      text: transcription.text,
      materialId: transcription.materialId,
      projectId: transcription.projectId,
      materialStatus: transcription.material?.status,
      material: materialResponse,
      createdAt: transcription.createdAt,
      updatedAt: transcription.updatedAt,
    })
  } catch (error: any) {
    console.error('[INTERVIEW] Get transcription status error:', error)
    return NextResponse.json(
      {
        error: '文字起こしステータスの取得に失敗しました',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

