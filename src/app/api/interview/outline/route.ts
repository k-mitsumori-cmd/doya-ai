import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateOutline } from '@/lib/interview/prompts'

// 構成案生成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, proposalId } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    // プロジェクト取得
    const project = await prisma.interviewProject.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
      include: {
        transcriptions: true,
        recipe: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 文字起こしテキストを結合
    const transcriptionText = project.transcriptions
      .map((t) => t.text)
      .join('\n\n')

    if (!transcriptionText) {
      return NextResponse.json({ error: 'No transcription found' }, { status: 400 })
    }

    // 企画案取得
    const proposal = proposalId
      ? (project.recipe?.proposals as any[])?.find((p: any) => p.id === proposalId)
      : null

    // 構成案生成
    const outline = await generateOutline(transcriptionText, proposal || {
      title: project.title,
      summary: project.theme || '',
      questions: [],
      value: '',
    })

    // プロジェクトに保存
    await prisma.interviewProject.update({
      where: { id: projectId },
      data: { outline },
    })

    return NextResponse.json({ outline })
  } catch (error) {
    console.error('[INTERVIEW] Outline generation error:', error)
    return NextResponse.json({ error: 'Failed to generate outline' }, { status: 500 })
  }
}


