import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { del } from '@vercel/blob'

// Vercel等のサーバーレス環境では /tmp を使用
function getUploadBaseDir() {
  const envDir = process.env.INTERVIEW_STORAGE_DIR || process.env.NEXT_PUBLIC_INTERVIEW_STORAGE_DIR
  if (envDir) return envDir
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return '/tmp/interview'
  }
  return join(process.cwd(), 'uploads', 'interview')
}

// プロジェクトのファイルを削除する関数
async function deleteProjectFiles(projectId: string) {
  try {
    // プロジェクトに関連する素材を取得
    const materials = await prisma.interviewMaterial.findMany({
      where: { projectId },
      select: {
        id: true,
        fileUrl: true,
        filePath: true,
      },
    })

    // Vercel Blob Storageからファイルを削除
    for (const material of materials) {
      if (material.fileUrl) {
        try {
          await del(material.fileUrl)
          console.log(`[INTERVIEW] Deleted file from Blob Storage: ${material.fileUrl}`)
        } catch (blobError) {
          console.error(`[INTERVIEW] Failed to delete file from Blob Storage: ${material.fileUrl}`, blobError)
          // エラーが発生しても処理は続行
        }
      }
    }

    // ローカルファイルシステムからも削除（フォールバック）
    const baseDir = getUploadBaseDir()
    const projectDir = join(baseDir, projectId)
    const chunkDir = join(baseDir, 'chunks', projectId)

    try {
      // プロジェクトディレクトリを削除
      if (existsSync(projectDir)) {
        await rm(projectDir, { recursive: true, force: true })
        console.log(`[INTERVIEW] Deleted project directory: ${projectDir}`)
      }

      // チャンクディレクトリを削除
      if (existsSync(chunkDir)) {
        await rm(chunkDir, { recursive: true, force: true })
        console.log(`[INTERVIEW] Deleted chunk directory: ${chunkDir}`)
      }
    } catch (localError) {
      console.warn(`[INTERVIEW] Failed to delete local files for project ${projectId}:`, localError)
      // エラーが発生しても処理は続行
    }
  } catch (error) {
    console.error(`[INTERVIEW] Failed to delete files for project ${projectId}:`, error)
    // エラーが発生しても処理は続行（ファイルが既に削除されている可能性がある）
  }
}

// 3ヶ月経過したプロジェクトを自動削除
export async function GET(request: NextRequest) {
  try {
    // 認証: Vercel Cron Jobsからのリクエストか確認
    // Vercel Cron Jobsは自動的に `x-vercel-cron` ヘッダーを送信する
    const vercelCronHeader = request.headers.get('x-vercel-cron')
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

    // Vercel Cron Jobsからのリクエストか確認
    const isVercelCron = vercelCronHeader === '1' || vercelCronHeader === 'true'
    const isAuthorizedSecret = cronSecret && authHeader === `Bearer ${cronSecret}`

    // 本番環境では、Vercel Cronまたは認証トークンが必要
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      if (!isVercelCron && !isAuthorizedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // 3ヶ月前の日時を計算
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    console.log(`[INTERVIEW] Starting cleanup for projects created before ${threeMonthsAgo.toISOString()}`)

    // 3ヶ月経過したプロジェクトを取得
    const oldProjects = await prisma.interviewProject.findMany({
      where: {
        createdAt: {
          lt: threeMonthsAgo,
        },
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    })

    console.log(`[INTERVIEW] Found ${oldProjects.length} projects to delete`)

    let deletedCount = 0
    let errorCount = 0

    // 各プロジェクトを削除
    for (const project of oldProjects) {
      try {
        // プロジェクトIDを保存
        const projectId = project.id

        // ファイルを先に削除（データベースから削除する前にファイル情報を取得するため）
        await deleteProjectFiles(projectId)

        // データベースから削除（Cascadeで関連データも削除される）
        await prisma.interviewProject.delete({
          where: { id: projectId },
        })

        deletedCount++
        console.log(`[INTERVIEW] Deleted project: ${project.id} (${project.title || '無題'})`)
      } catch (error) {
        errorCount++
        console.error(`[INTERVIEW] Failed to delete project ${project.id}:`, error)
        // エラーが発生しても次のプロジェクトの処理を続行
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed: ${deletedCount} projects deleted, ${errorCount} errors`,
      deletedCount,
      errorCount,
      totalFound: oldProjects.length,
    })
  } catch (error) {
    console.error('[INTERVIEW] Cleanup error:', error)
    return NextResponse.json(
      {
        error: 'Failed to cleanup old projects',
        details: error instanceof Error ? error.message : '不明なエラー',
      },
      { status: 500 }
    )
  }
}

