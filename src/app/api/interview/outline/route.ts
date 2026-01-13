import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateOutline } from '@/lib/interview/prompts'
import { notifyApiError } from '@/lib/errorHandler'

export const dynamic = 'force-dynamic'

// 構成案生成
export async function POST(request: NextRequest) {
  try {
    // 認証チェック（ユーザーまたはゲスト）
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, proposalId } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    // プロジェクト取得（ユーザーまたはゲスト）
    let project = await prisma.interviewProject.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId: userId || undefined },
          { guestId: guestId || undefined },
        ],
      },
      include: {
        transcriptions: {
          include: {
            material: true,
          },
        },
        recipe: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 完了した文字起こしのみを取得（COMPLETED ステータスでテキストが存在するもの）
    let completedTranscriptions = project.transcriptions.filter(
      (t) => t.status === 'COMPLETED' && t.text && typeof t.text === 'string' && t.text.trim().length > 0
    )

    // 処理中の文字起こしを確認
    const processingTranscriptions = project.transcriptions.filter(
      (t) => t.status === 'PROCESSING' || t.status === 'PENDING'
    )

    console.log('[INTERVIEW] Outline generation request:', {
      projectId,
      totalTranscriptionCount: project.transcriptions.length,
      completedCount: completedTranscriptions.length,
      processingCount: processingTranscriptions.length,
      transcriptionTextLength: completedTranscriptions.reduce((sum, t) => sum + (t.text?.length || 0), 0),
    })

    // 処理中の文字起こしがある場合は、即座にエラーを返す
    // フロントエンド側で待機処理を実装しているため、API側では待機しない
    // これによりVercelのタイムアウト（300秒）を回避できる
    if (processingTranscriptions.length > 0) {
      console.log('[INTERVIEW] Outline generation blocked: Transcription still processing:', {
        projectId,
        processingCount: processingTranscriptions.length,
        processingIds: processingTranscriptions.map((t) => t.id),
        note: 'Frontend will wait and retry',
      })

      return NextResponse.json(
        {
          error: 'Transcription still processing',
          details: '文字起こしがまだ処理中です。文字起こしが完了するまでお待ちください。',
          processingCount: processingTranscriptions.length,
          processingIds: processingTranscriptions.map((t) => t.id),
        },
        { status: 400 }
      )
    }

    // 完了した文字起こしが存在しない場合はエラーを返す
    if (completedTranscriptions.length === 0) {
      console.error('[INTERVIEW] Outline generation blocked: No completed transcription found:', {
        projectId,
        totalCount: project.transcriptions.length,
        transcriptionStatuses: project.transcriptions.map((t) => ({
          id: t.id,
          status: t.status,
          hasText: !!(t.text && t.text.trim().length > 0),
          textLength: t.text?.length || 0,
        })),
      })
      return NextResponse.json(
        {
          error: 'No completed transcription',
          details: '文字起こしが完了していません。全ての文字起こしが完了するまでお待ちください。',
        },
        { status: 400 }
      )
    }

    // 全ての文字起こしが完了していることを確認（処理中または保留中のものがない）
    const allTranscriptions = project.transcriptions || []
    const notCompletedTranscriptions = allTranscriptions.filter(
      (t) => t.status !== 'COMPLETED' || !t.text || t.text.trim().length === 0
    )
    
    if (notCompletedTranscriptions.length > 0) {
      // エラー状態の文字起こしがある場合はエラーを返す
      const errorTranscriptions = notCompletedTranscriptions.filter((t) => t.status === 'ERROR')
      if (errorTranscriptions.length > 0) {
        return NextResponse.json(
          {
            error: 'Transcription failed',
            details: '文字起こし処理でエラーが発生しました。ファイルを再アップロードしてください。',
            errorCount: errorTranscriptions.length,
          },
          { status: 400 }
        )
      }

      // その他の未完了の文字起こしがある場合（これは通常は発生しないが、念のため）
      console.error('[INTERVIEW] Outline generation blocked: Some transcriptions not completed:', {
        projectId,
        totalCount: allTranscriptions.length,
        completedCount: completedTranscriptions.length,
        notCompletedCount: notCompletedTranscriptions.length,
        notCompletedStatuses: notCompletedTranscriptions.map((t) => ({
          id: t.id,
          status: t.status,
          hasText: !!(t.text && t.text.trim().length > 0),
          textLength: t.text?.length || 0,
        })),
      })
      return NextResponse.json(
        {
          error: 'Incomplete transcription',
          details: '全ての文字起こしが完了していません。全ての文字起こしが完了するまでお待ちください。',
          notCompletedCount: notCompletedTranscriptions.length,
        },
        { status: 400 }
      )
    }

    // 文字起こしテキストを結合
    const transcriptionText = completedTranscriptions
      .map((t) => t.text)
      .join('\n\n')

    if (!transcriptionText || transcriptionText.trim() === '') {
      console.error('[INTERVIEW] Outline generation blocked: Transcription text is empty:', {
        projectId,
        totalCount: project.transcriptions.length,
        completedCount: completedTranscriptions.length,
        transcriptionStatuses: project.transcriptions.map((t) => ({
          id: t.id,
          status: t.status,
          hasText: !!(t.text && t.text.trim().length > 0),
          textLength: t.text?.length || 0,
        })),
      })
      
      // エラーの詳細を確認
      const errorTranscriptions = project.transcriptions.filter((t) => t.status === 'ERROR')
      if (errorTranscriptions.length > 0) {
        return NextResponse.json(
          {
            error: 'Transcription failed',
            details: '文字起こし処理でエラーが発生しました。ファイルを再アップロードしてください。',
            errorCount: errorTranscriptions.length,
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          error: 'No transcription found',
          details: '文字起こしが完了していません。文字起こしを先に実行してください。',
          transcriptionStatuses: project.transcriptions.map((t) => ({
            status: t.status,
            hasText: !!(t.text && t.text.trim().length > 0),
          })),
        },
        { status: 400 }
      )
    }

    // 企画案取得
    const proposal = proposalId
      ? (project.recipe?.proposals as any[])?.find((p: any) => p.id === proposalId)
      : null

    // 構成案生成
    console.log('[INTERVIEW] Generating outline...')
    const outline = await generateOutline(transcriptionText, proposal || {
      title: project.title,
      summary: project.theme || '',
      questions: [],
      value: '',
    })

    console.log('[INTERVIEW] Outline generated successfully, length:', outline?.length || 0)

    // プロジェクトに保存
    await prisma.interviewProject.update({
      where: { id: projectId },
      data: { outline },
    })

    console.log('[INTERVIEW] Outline saved to project:', projectId)
    return NextResponse.json({ outline })
  } catch (error) {
    console.error('[INTERVIEW] Outline generation error:', error)
    await notifyApiError(error, request, 500, { endpoint: 'POST /api/interview/outline', projectId })
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to generate outline',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}


