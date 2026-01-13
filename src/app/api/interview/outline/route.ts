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

    // 処理中の文字起こしがある場合は、完了するまで待機
    if (processingTranscriptions.length > 0) {
      console.log('[INTERVIEW] Waiting for transcriptions to complete:', {
        projectId,
        processingCount: processingTranscriptions.length,
        processingIds: processingTranscriptions.map((t) => t.id),
      })

      // 最大待機時間を計算（各文字起こしのファイルサイズに基づく）
      const calculateMaxWaitTime = (materialId: string): number => {
        // 文字起こしに関連する素材を取得
        const transcription = project.transcriptions.find((t) => t.materialId === materialId)
        const material = transcription?.material
        
        if (!material || !material.fileSize) {
          return 30 * 60 // デフォルト30分（秒）
        }
        
        const fileSizeMB = Number(material.fileSize) / (1024 * 1024)
        const fileSizeGB = fileSizeMB / 1024
        const materialType = material.type || 'audio'
        
        let estimatedSeconds = 0
        
        if (materialType === 'video') {
          // 動画ファイルの場合: 音声抽出時間 + 文字起こし時間
          const audioLengthMinutes = fileSizeGB * 60 // 1GB ≈ 1時間
          const extractionTime = audioLengthMinutes * 4 // 1分の動画 ≈ 約4秒
          const transcriptionTime = audioLengthMinutes * 60 * 0.2 // 音声長の20%
          estimatedSeconds = extractionTime + transcriptionTime
        } else {
          // 音声ファイルの場合: 文字起こし時間のみ
          const audioLengthMinutes = fileSizeMB * 1.08
          const transcriptionTime = audioLengthMinutes * 60 * 0.2 // 音声長の20%
          estimatedSeconds = transcriptionTime
        }
        
        // バッファ時間を追加（処理時間の50%、最低10分）
        const bufferTime = Math.max(10 * 60, estimatedSeconds * 0.5)
        const totalSeconds = estimatedSeconds + bufferTime
        
        // 最小待機時間: 5分、最大待機時間: 3日（72時間）
        const minWaitTime = 5 * 60 // 5分
        const maxWaitTime = 3 * 24 * 60 * 60 // 3日（72時間）
        
        return Math.max(minWaitTime, Math.min(maxWaitTime, totalSeconds))
      }

      // 最大待機時間を計算（すべての処理中の文字起こしの最大値）
      let maxWaitTimeSeconds = 0
      for (const transcription of processingTranscriptions) {
        const waitTime = calculateMaxWaitTime(transcription.materialId)
        maxWaitTimeSeconds = Math.max(maxWaitTimeSeconds, waitTime)
      }

      // 待機間隔: ファイルサイズに応じて調整
      let waitInterval = 2000 // デフォルト2秒
      if (maxWaitTimeSeconds >= 24 * 60 * 60) {
        waitInterval = 30000 // 24時間以上なら30秒
      } else if (maxWaitTimeSeconds >= 6 * 60 * 60) {
        waitInterval = 10000 // 6時間以上なら10秒
      } else if (maxWaitTimeSeconds >= 60 * 60) {
        waitInterval = 5000 // 1時間以上なら5秒
      }
      const maxRetries = Math.ceil(maxWaitTimeSeconds / (waitInterval / 1000))

      console.log(`[INTERVIEW] Transcription wait time calculated:`, {
        maxWaitTimeMinutes: (maxWaitTimeSeconds / 60).toFixed(1),
        maxWaitTimeHours: (maxWaitTimeSeconds / 3600).toFixed(2),
        waitInterval,
        maxRetries,
      })

      // 全ての処理中の文字起こしが完了するまで待機
      const startTime = Date.now()
      for (const transcription of processingTranscriptions) {
        let retryCount = 0
        let completed = false

        while (retryCount < maxRetries && !completed) {
          await new Promise(resolve => setTimeout(resolve, waitInterval))
          retryCount++

          // プロジェクトを再取得して最新の状態を確認
          const updatedProject = await prisma.interviewProject.findFirst({
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

          if (!updatedProject) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
          }

          // 対象の文字起こしを確認
          const currentTranscription = updatedProject.transcriptions.find((t) => t.id === transcription.id)
          
          if (currentTranscription && 
              currentTranscription.status === 'COMPLETED' && 
              currentTranscription.text && 
              currentTranscription.text.trim().length > 0) {
            completed = true
            console.log('[INTERVIEW] Transcription completed:', {
              transcriptionId: transcription.id,
              textLength: currentTranscription.text.length,
            })
          } else if (currentTranscription && currentTranscription.status === 'ERROR') {
            return NextResponse.json(
              {
                error: 'Transcription failed',
                details: '文字起こし処理でエラーが発生しました。ファイルを再アップロードしてください。',
                transcriptionId: transcription.id,
              },
              { status: 400 }
            )
          }

          // タイムアウトチェック
          const elapsedSeconds = (Date.now() - startTime) / 1000
          if (elapsedSeconds > maxWaitTimeSeconds) {
            return NextResponse.json(
              {
                error: 'Transcription timeout',
                details: `文字起こし処理がタイムアウトしました（最大待機時間: ${Math.ceil(maxWaitTimeSeconds / 60)}分）。しばらく待ってから再度お試しください。`,
                transcriptionId: transcription.id,
              },
              { status: 400 }
            )
          }
        }

        if (!completed) {
          return NextResponse.json(
            {
              error: 'Transcription timeout',
              details: `文字起こし処理がタイムアウトしました。しばらく待ってから再度お試しください。`,
              transcriptionId: transcription.id,
            },
            { status: 400 }
          )
        }
      }

      // 待機後にプロジェクトを再取得して最新の状態を確認
      const updatedProject = await prisma.interviewProject.findFirst({
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

      if (!updatedProject) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      // 最新の状態で完了した文字起こしを再取得
      project = updatedProject
      completedTranscriptions = project.transcriptions.filter(
        (t) => t.status === 'COMPLETED' && t.text && typeof t.text === 'string' && t.text.trim().length > 0
      )
      
      console.log('[INTERVIEW] All transcriptions completed after waiting:', {
        projectId,
        completedCount: completedTranscriptions.length,
        totalCount: project.transcriptions.length,
      })
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


