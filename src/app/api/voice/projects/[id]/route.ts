// ============================================
// GET / PUT / DELETE /api/voice/projects/[id]
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET — プロジェクト詳細
 */
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
      include: { recordings: { orderBy: { order: 'asc' } } },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        recordings: project.recordings.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    console.error('Voice project GET error:', error)
    return NextResponse.json(
      { success: false, error: 'プロジェクトの取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * PUT — プロジェクト更新
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    const existing = await prisma.voiceProject.findFirst({
      where: { id: params.id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    const body = await req.json()
    const {
      name,
      inputText,
      speakerId,
      speed,
      pitch,
      volume,
      outputFormat,
      emotionTone,
      pauseLength,
      isFavorite,
      status,
    } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = String(name).slice(0, 100)
    if (inputText !== undefined) updateData.inputText = String(inputText).slice(0, 5000)
    if (speakerId !== undefined) updateData.speakerId = String(speakerId).slice(0, 50)
    if (speed !== undefined) updateData.speed = Math.min(2.0, Math.max(0.5, Number(speed)))
    if (pitch !== undefined) updateData.pitch = Math.min(10, Math.max(-10, Number(pitch)))
    if (volume !== undefined) updateData.volume = Math.min(100, Math.max(0, Number(volume)))
    if (outputFormat !== undefined) updateData.outputFormat = String(outputFormat).slice(0, 10)
    if (emotionTone !== undefined) updateData.emotionTone = String(emotionTone).slice(0, 20)
    if (pauseLength !== undefined) updateData.pauseLength = String(pauseLength).slice(0, 20)
    if (isFavorite !== undefined) updateData.isFavorite = Boolean(isFavorite)
    if (status !== undefined) updateData.status = String(status).slice(0, 20)

    const updated = await prisma.voiceProject.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      project: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Voice project PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'プロジェクトの更新に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE — プロジェクト削除
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    const existing = await prisma.voiceProject.findFirst({
      where: { id: params.id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    // 録音データも一緒に削除（cascadeで自動削除されるが明示的に）
    await prisma.voiceProject.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Voice project DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'プロジェクトの削除に失敗しました' },
      { status: 500 }
    )
  }
}
