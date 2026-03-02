// ============================================
// GET / POST /api/voice/projects
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET — プロジェクト一覧
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: true, projects: [] })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))
    const status = searchParams.get('status') || undefined
    const favorite = searchParams.get('favorite') === 'true' ? true : undefined

    const where: any = { userId: user.id }
    if (status) where.status = status
    if (favorite !== undefined) where.isFavorite = favorite

    const [total, projects] = await Promise.all([
      prisma.voiceProject.count({ where }),
      prisma.voiceProject.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          speakerId: true,
          inputText: true,
          outputFormat: true,
          outputUrl: true,
          durationMs: true,
          fileSize: true,
          isFavorite: true,
          emotionTone: true,
          speed: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      projects: projects.map((p) => ({
        ...p,
        textExcerpt: p.inputText.slice(0, 100),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Voice projects GET error:', error)
    return NextResponse.json(
      { success: false, error: 'プロジェクト一覧の取得に失敗しました', projects: [] },
      { status: 500 }
    )
  }
}

/**
 * POST — プロジェクト新規作成（下書き）
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await req.json()
    const { name, inputText, speakerId = 'akira', speed = 1.0, pitch = 0, volume = 100, outputFormat = 'mp3', emotionTone = 'neutral', pauseLength = 'standard' } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'プロジェクト名は必須です' }, { status: 400 })
    }

    const project = await prisma.voiceProject.create({
      data: {
        userId: user.id,
        name: name.trim().slice(0, 100),
        status: 'draft',
        speakerId: String(speakerId).slice(0, 50),
        speed: Math.min(2.0, Math.max(0.5, Number(speed) || 1.0)),
        pitch: Math.min(10, Math.max(-10, Number(pitch) || 0)),
        volume: Math.min(100, Math.max(0, Number(volume) || 100)),
        pauseLength: String(pauseLength).slice(0, 20),
        emotionTone: String(emotionTone).slice(0, 20),
        inputText: inputText ? String(inputText).slice(0, 5000) : '',
        outputFormat: String(outputFormat).slice(0, 10),
      },
    })

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Voice projects POST error:', error)
    return NextResponse.json(
      { success: false, error: 'プロジェクト作成に失敗しました' },
      { status: 500 }
    )
  }
}
