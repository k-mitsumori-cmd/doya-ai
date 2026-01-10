import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateDraft } from '@/lib/interview/prompts'
import { notifyApiError } from '@/lib/errorHandler'

export const dynamic = 'force-dynamic'

// 記事ドラフト生成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, articleType: requestedArticleType, displayFormat: requestedDisplayFormat } = body

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

    console.log('[INTERVIEW] Draft generation request:', {
      projectId,
      hasOutline: !!project.outline,
      outlineLength: project.outline?.length || 0,
      transcriptionCount: project.transcriptions.length,
    })

    if (!project.outline) {
      console.error('[INTERVIEW] Outline not found for project:', projectId)
      return NextResponse.json(
        { 
          error: 'Outline not found',
          details: '構成案が生成されていません。構成案を先に生成してください。'
        },
        { status: 400 }
      )
    }

    // 文字起こしテキストを結合
    const transcriptionText = project.transcriptions
      .map((t) => t.text)
      .join('\n\n')

    if (!transcriptionText || transcriptionText.trim() === '') {
      console.error('[INTERVIEW] No transcription found for project:', projectId)
      return NextResponse.json(
        { 
          error: 'No transcription found',
          details: '文字起こしが完了していません。文字起こしを先に実行してください。'
        },
        { status: 400 }
      )
    }

    // 記事タイプと表示形式のデフォルト値
    const articleType = (requestedArticleType as string) || 'INTERVIEW'
    const displayFormat = (requestedDisplayFormat as string) || 'QA'

    // 記事ドラフト生成
    console.log('[INTERVIEW] Generating draft...', {
      transcriptionLength: transcriptionText.length,
      outlineLength: project.outline.length,
      articleType,
      displayFormat,
    })
    
    const draftContent = await generateDraft(
      transcriptionText,
      project.outline,
      project.tone || 'friendly',
      articleType as any,
      displayFormat as any
    )

    console.log('[INTERVIEW] Draft generated successfully, length:', draftContent?.length || 0)

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
        articleType,
        displayFormat,
      },
    })

    console.log('[INTERVIEW] Draft saved to database:', draft.id)
    return NextResponse.json({ draft })
  } catch (error) {
    console.error('[INTERVIEW] Draft generation error:', error)
    await notifyApiError(error, request, 500, { endpoint: 'POST /api/interview/draft', projectId })
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to generate draft',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}


