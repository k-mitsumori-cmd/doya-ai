import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { del } from '@vercel/blob'

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
  } catch (error) {
    console.error(`[INTERVIEW] Failed to delete files for project ${projectId}:`, error)
    // エラーが発生しても処理は続行（ファイルが既に削除されている可能性がある）
  }
}

// 容量不足時に古いプロジェクトを自動削除
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const targetFreeBytes = body.targetFreeBytes || 100 * 1024 * 1024 // デフォルト: 100MB

    // 現在の使用状況を取得
    const materials = await prisma.interviewMaterial.findMany({
      include: {
        project: {
          select: {
            id: true,
            createdAt: true,
            title: true,
          },
        },
      },
      orderBy: {
        project: {
          createdAt: 'asc', // 古い順
        },
      },
    })

    const totalSize = materials.reduce((sum, material) => {
      return sum + (material.fileSize || 0)
    }, 0)

    const HOBBY_PLAN_LIMIT = 1024 * 1024 * 1024
    const currentFreeBytes = HOBBY_PLAN_LIMIT - totalSize

    // 既に十分な容量がある場合
    if (currentFreeBytes >= targetFreeBytes) {
      return NextResponse.json({
        success: true,
        message: '十分な容量があります',
        currentFreeBytes,
        targetFreeBytes,
        deletedCount: 0,
      })
    }

    // 必要な容量を計算
    const neededBytes = targetFreeBytes - currentFreeBytes

    // 古いプロジェクトから順に削除
    const projectsToDelete = new Set<string>()
    let freedBytes = 0

    for (const material of materials) {
      if (freedBytes >= neededBytes) {
        break
      }

      const projectId = material.projectId
      if (!projectsToDelete.has(projectId)) {
        projectsToDelete.add(projectId)
        freedBytes += material.fileSize || 0
      }
    }

    let deletedCount = 0
    let errorCount = 0

    // プロジェクトを削除
    for (const projectId of projectsToDelete) {
      try {
        // ファイルを先に削除
        await deleteProjectFiles(projectId)

        // データベースから削除
        await prisma.interviewProject.delete({
          where: { id: projectId },
        })

        deletedCount++
        console.log(`[INTERVIEW] Deleted project for cleanup: ${projectId}`)
      } catch (error) {
        errorCount++
        console.error(`[INTERVIEW] Failed to delete project ${projectId}:`, error)
        // エラーが発生しても次のプロジェクトの処理を続行
      }
    }

    return NextResponse.json({
      success: true,
      message: `クリーンアップ完了: ${deletedCount}プロジェクト削除`,
      deletedCount,
      errorCount,
      freedBytes,
      currentFreeBytes: currentFreeBytes + freedBytes,
    })
  } catch (error) {
    console.error('[INTERVIEW] Cleanup error:', error)
    return NextResponse.json(
      {
        error: 'クリーンアップに失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー',
      },
      { status: 500 }
    )
  }
}

