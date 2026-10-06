export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { uploadLogo } from '@/lib/doyaslide/storage'
import sharp from 'sharp'

// SVGはスクリプト混入の恐れがあるため公開バケットには保存しない
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
}
const MAX_SIZE = 5 * 1024 * 1024

// POST /api/doyaslide/assets/logo — ロゴをアップロードし project.logoUrl に設定
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file')
    const projectId = formData.get('projectId')
    if (projectId !== null && (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(projectId))) {
      return NextResponse.json({ error: 'プロジェクトIDが正しくありません。' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })
    }
    const ext = ALLOWED[file.type]
    if (!ext) {
      return NextResponse.json({ error: 'PNG / JPG / WebP のみ対応しています。' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_SIZE) {
      return NextResponse.json({ error: '画像サイズは5MB以下にしてください' }, { status: 400 })
    }

    // Check ownership and busy slides before paying for an upload or reading its file body.
    const project = projectId ? await prisma.doyaSlideProject.findFirst({
      where: { id: projectId, userId },
      include: { _count: { select: { slides: { where: { status: 'generating' } } } } },
    }) : null
    if (projectId && !project) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })
    if (project && (['structuring', 'generating'].includes(project.status) || project._count.slides > 0)) {
      return NextResponse.json({ error: '資料を処理中のためロゴを変更できません。完了後にお試しください。' }, { status: 409 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!buffer.length || buffer.length > MAX_SIZE) return NextResponse.json({ error: '有効な5MB以下の画像を指定してください。' }, { status: 400 })
    try {
      const image = sharp(buffer, { limitInputPixels: 32 * 1024 * 1024, failOn: 'warning' })
      const meta = await image.metadata()
      const expected = ext === 'jpg' ? 'jpeg' : ext
      if (meta.format !== expected || !meta.width || !meta.height || meta.width > 8192 || meta.height > 8192) throw new Error('Invalid logo image')
      // Metadata alone can accept a truncated file. Decode every pixel before storing it.
      await image.stats()
    } catch {
      return NextResponse.json({ error: '画像の内容を確認できませんでした。PNG / JPG / WebP の画像を指定してください。' }, { status: 400 })
    }
    const url = await uploadLogo(userId, buffer, ext, file.type)

    if (project) {
      // The project or its processing state may have changed while Storage was responding.
      await prisma.doyaSlideProject.update({
        where: {
          id: project.id, userId, updatedAt: project.updatedAt,
          status: { notIn: ['structuring', 'generating'] },
          slides: { none: { status: 'generating' } },
        },
        data: { logoUrl: url },
      })
    }

    return NextResponse.json({ url })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: '資料の状態が変わりました。再読み込みしてご確認ください。' }, { status: 409 })
    console.error('[doyaslide/assets/logo]')
    return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 })
  }
}
