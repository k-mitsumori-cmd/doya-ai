export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withDoyaSlideProjectLock } from '@/lib/doyaslide/project-lock'
import { getUserId } from '@/lib/doyaslide/access'
import { uploadLogo } from '@/lib/doyaslide/storage'
import sharp from 'sharp'
import { directUploadRollout, isDirectConfirm } from '@/lib/direct-upload/flag'
import { IMAGE_UPLOAD_MAX, readStagedImage, removeStaged } from '@/lib/direct-upload/stage'

// SVGはスクリプト混入の恐れがあるため公開バケットには保存しない
const LEGACY_ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
}
const LEGACY_MAX_SIZE = 5 * 1024 * 1024

// POST /api/doyaslide/assets/logo — ロゴをアップロードし project.logoUrl に設定
async function postLegacy(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const formData = await req.formData().catch(() => null)
    if (!formData) return NextResponse.json({ error: 'ファイルの送信形式が正しくありません。' }, { status: 400 })
    const file = formData.get('file')
    const projectId = formData.get('projectId')
    if (projectId !== null && (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(projectId))) {
      return NextResponse.json({ error: 'プロジェクトIDが正しくありません。' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })
    }
    const ext = LEGACY_ALLOWED[file.type]
    if (!ext) {
      return NextResponse.json({ error: 'PNG / JPG / WebP のみ対応しています。' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > LEGACY_MAX_SIZE) {
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
    if (!buffer.length || buffer.length > LEGACY_MAX_SIZE) return NextResponse.json({ error: '有効な5MB以下の画像を指定してください。' }, { status: 400 })
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
      await withDoyaSlideProjectLock(project.id, userId, tx => tx.doyaSlideProject.update({
        where: {
          id: project.id, userId, updatedAt: project.updatedAt,
          status: { notIn: ['structuring', 'generating'] },
          slides: { none: { status: 'generating' } },
        },
        data: { logoUrl: url },
      }))
    }

    return NextResponse.json({ url })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: '資料の状態が変わりました。再読み込みしてご確認ください。' }, { status: 409 })
    console.error('[doyaslide/assets/logo]')
    return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 })
  }
}

// SVGはスクリプト混入の恐れがあるため公開バケットには保存しない（upload-url 側で形式を限定済み）
const MAX_SIZE = IMAGE_UPLOAD_MAX
const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

// POST /api/doyaslide/assets/logo — ロゴのアップロード完了通知。project.logoUrl に設定する
// ブラウザは /api/doyaslide/assets/logo/upload-url の署名付きURLへ直接送り済み。JSON: { path, projectId? }
async function postDirect(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const projectId = body?.projectId ?? null
    if (projectId !== null && (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(projectId))) {
      return NextResponse.json({ error: 'プロジェクトIDが正しくありません。' }, { status: 400 })
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

    const staged = await readStagedImage(userId, body?.path, MAX_SIZE)
    if (!staged.ok) return NextResponse.json({ error: staged.error }, { status: staged.status })
    const buffer = staged.buffer
    const ext = staged.ext
    try {
      const image = sharp(buffer, { limitInputPixels: 32 * 1024 * 1024, failOn: 'warning' })
      const meta = await image.metadata()
      const expected = ext === 'jpg' ? 'jpeg' : ext
      if (meta.format !== expected || !meta.width || !meta.height || meta.width > 8192 || meta.height > 8192) throw new Error('Invalid logo image')
      // Metadata alone can accept a truncated file. Decode every pixel before storing it.
      await image.stats()
    } catch {
      await removeStaged(staged.path)
      return NextResponse.json({ error: '画像の内容を確認できませんでした。PNG / JPG / WebP の画像を指定してください。' }, { status: 400 })
    }
    const url = await uploadLogo(userId, buffer, ext, MIME_BY_EXT[ext])
    await removeStaged(staged.path)

    if (project) {
      // The project or its processing state may have changed while Storage was responding.
      await withDoyaSlideProjectLock(project.id, userId, tx => tx.doyaSlideProject.update({
        where: {
          id: project.id, userId, updatedAt: project.updatedAt,
          status: { notIn: ['structuring', 'generating'] },
          slides: { none: { status: 'generating' } },
        },
        data: { logoUrl: url },
      }))
    }

    return NextResponse.json({ url })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: '資料の状態が変わりました。再読み込みしてご確認ください。' }, { status: 409 })
    console.error('[doyaslide/assets/logo]')
    return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 })
  }
}

// 旗（DIRECT_UPLOAD_ROLLOUT）が off のあいだは、これまでの FormData の経路だけが動く。
export async function POST(req: NextRequest) {
  if (isDirectConfirm(req)) {
    if (!directUploadRollout()) return NextResponse.json({ error: '直接アップロードは有効になっていません' }, { status: 404 })
    return postDirect(req)
  }
  return postLegacy(req)
}
