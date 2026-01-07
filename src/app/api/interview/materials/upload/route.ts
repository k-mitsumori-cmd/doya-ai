import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// 素材アップロード（音声・動画・テキスト・PDF等）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const projectId = formData.get('projectId') as string
    const file = formData.get('file') as File

    if (!projectId || !file) {
      return NextResponse.json({ error: 'Missing projectId or file' }, { status: 400 })
    }

    // プロジェクトの所有権確認
    const project = await prisma.interviewProject.findFirst({
      where: {
        id: projectId,
        OR: [{ userId: userId || undefined }, { guestId: guestId || undefined }],
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // ファイルタイプ判定
    const mimeType = file.type
    let materialType = 'text'
    if (mimeType.startsWith('audio/')) materialType = 'audio'
    else if (mimeType.startsWith('video/')) materialType = 'video'
    else if (mimeType === 'application/pdf') materialType = 'pdf'
    else if (mimeType.startsWith('image/')) materialType = 'image'
    else if (mimeType.startsWith('text/')) materialType = 'text'

    // ファイル保存
    const uploadDir = join(process.cwd(), 'uploads', 'interview', projectId)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const fileName = `${Date.now()}-${file.name}`
    const filePath = join(uploadDir, fileName)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    await writeFile(filePath, buffer)

    // DBに記録
    const material = await prisma.interviewMaterial.create({
      data: {
        projectId,
        type: materialType,
        fileName: file.name,
        filePath: `/uploads/interview/${projectId}/${fileName}`,
        fileSize: buffer.length,
        mimeType,
        status: 'UPLOADED',
      },
    })

    return NextResponse.json({ material })
  } catch (error) {
    console.error('[INTERVIEW] Material upload error:', error)
    return NextResponse.json({ error: 'Failed to upload material' }, { status: 500 })
  }
}

