export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { uploadLogo } from '@/lib/doyaslide/storage'

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
    const projectId = formData.get('projectId') as string | null
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })
    }
    const ext = ALLOWED[file.type]
    if (!ext) {
      return NextResponse.json({ error: 'PNG / JPG / WebP / SVG のみ対応しています' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '画像サイズは5MB以下にしてください' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const url = await uploadLogo(userId, buffer, ext, file.type)

    // projectId が指定されていれば所有確認の上で紐付け
    if (projectId) {
      const project = await prisma.doyaSlideProject.findFirst({ where: { id: projectId, userId } })
      if (project) {
        await prisma.doyaSlideProject.update({ where: { id: projectId }, data: { logoUrl: url } })
      }
    }

    return NextResponse.json({ url })
  } catch (e: any) {
    console.error('[doyaslide/assets/logo]', e?.message)
    return NextResponse.json({ error: e?.message || 'アップロードに失敗しました' }, { status: 500 })
  }
}
