import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateDraft } from '@/lib/interview/prompts'

// 記事ドラフト生成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId } = body

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
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.outline) {
      return NextResponse.json({ error: 'Outline not found. Please generate outline first.' }, { status: 400 })
    }

    // 文字起こしテキストを結合
    const transcriptionText = project.transcriptions
      .map((t) => t.text)
      .join('\n\n')

    if (!transcriptionText) {
      return NextResponse.json({ error: 'No transcription found' }, { status: 400 })
    }

    // 記事ドラフト生成
    const draftContent = await generateDraft(transcriptionText, project.outline, project.tone || 'friendly')

    // 文字数カウント
    const wordCount = draftContent.length
    const readingTime = Math.ceil(wordCount / 400) // 1分400文字として計算

    // ドラフト保存
    const draft = await prisma.interviewDraft.create({
      data: {
        projectId,
        version: 1,
        content: draftContent,
        wordCount,
        readingTime,
        status: 'DRAFT',
      },
    })

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('[INTERVIEW] Draft generation error:', error)
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 })
  }
}

