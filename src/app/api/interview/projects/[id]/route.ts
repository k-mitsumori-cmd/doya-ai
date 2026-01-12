import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { deleteFromGCS } from '@/lib/gcs'

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

    // Google Cloud Storageからファイルを削除
    for (const material of materials) {
      if (material.fileUrl) {
        try {
          await deleteFromGCS(material.fileUrl)
          console.log(`[INTERVIEW] Deleted file from Google Cloud Storage: ${material.fileUrl}`)
        } catch (gcsError) {
          console.error(`[INTERVIEW] Failed to delete file from Google Cloud Storage: ${material.fileUrl}`, gcsError)
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

// プロジェクト詳細取得
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await prisma.interviewProject.findFirst({
      where: {
        id: params.id,
        OR: [{ userId: userId || undefined }, { guestId: guestId || undefined }],
      },
      include: {
        materials: {
          orderBy: { createdAt: 'desc' },
        },
        transcriptions: {
          orderBy: { createdAt: 'desc' },
        },
        drafts: {
          orderBy: { version: 'desc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
        },
        recipe: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // BigIntを文字列に変換してレスポンスに含める
    const projectResponse = {
      ...project,
      materials: project.materials.map((material: any) => ({
        ...material,
        fileSize: material.fileSize ? material.fileSize.toString() : null,
      })),
    }

    return NextResponse.json({ project: projectResponse })
  } catch (error) {
    console.error('[INTERVIEW] Project fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

// プロジェクト更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const project = await prisma.interviewProject.updateMany({
      where: {
        id: params.id,
        OR: [{ userId: userId || undefined }, { guestId: guestId || undefined }],
      },
      data: {
        ...body,
        updatedAt: new Date(),
      },
    })

    if (project.count === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[INTERVIEW] Project update error:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

// プロジェクト削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 削除前にプロジェクトIDを保存（ファイル削除用）
    const projectId = params.id

    // ファイルを先に削除（データベースから削除する前にファイル情報を取得するため）
    await deleteProjectFiles(projectId)

    // プロジェクトを削除（Cascadeで関連データも削除される）
    const project = await prisma.interviewProject.deleteMany({
      where: {
        id: projectId,
        OR: [{ userId: userId || undefined }, { guestId: guestId || undefined }],
      },
    })

    if (project.count === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[INTERVIEW] Project delete error:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}


