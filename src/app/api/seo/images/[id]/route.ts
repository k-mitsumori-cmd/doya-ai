import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFileAsBuffer } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getGuestIdFromRequest } from '@/lib/seoAccess'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await ensureSeoSchema()
  const id = (await ctx.params).id
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null
  const userId = String(user?.id || '')
  const guestId = !userId ? getGuestIdFromRequest(_req) : null

  const img = await (prisma as any).seoImage.findUnique({
    where: { id },
    include: { article: { select: { userId: true, guestId: true } } },
  })
  if (!img) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
  // 所有者チェック（ユーザー/ゲストで分離）
  if (userId) {
    if (String(img?.article?.userId || '') !== userId) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
    }
  } else {
    if (img?.article?.userId || !guestId || String(img?.article?.guestId || '') !== guestId) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }
  }

  let buf: Buffer
  try {
    buf = await readFileAsBuffer(img.filePath)
  } catch (e: any) {
    const missing = e?.code === 'ENOENT'
    return NextResponse.json({
      success: false,
      code: missing ? 'IMAGE_FILE_MISSING' : 'IMAGE_READ_FAILED',
      error: missing ? '保存済みの画像が見つかりません。画像を再生成する場合は再生成操作を行ってください。' : '画像を読み込めませんでした。時間をおいて再度お試しください。',
    }, { status: missing ? 404 : 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
  // サムネイルモード: ?thumb=1 で半分サイズのJPEGに変換（一覧表示の高速化用）
  const isThumb = _req.nextUrl.searchParams.get('thumb') === '1'
  if (isThumb) {
    try {
      const meta = await sharp(buf).metadata()
      const thumbWidth = Math.round((meta.width || 800) / 2)
      const thumbBuf = await sharp(buf)
        .resize(thumbWidth)
        .jpeg({ quality: 75 })
        .toBuffer()
      return new NextResponse(new Uint8Array(thumbBuf), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'private, no-store',
        },
      })
    } catch {
      // sharp処理に失敗した場合はフルサイズで返す
    }
  }

  // BufferをUint8Arrayに変換してBodyInitとして渡す
  const body = new Uint8Array(buf)
  return new NextResponse(body, {
    headers: {
      'Content-Type': img.mimeType || 'image/png',
      'Cache-Control': 'private, no-store',
    },
  })
}


