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
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' }

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { return await readSeoImage(req, ctx) }
  catch { return NextResponse.json({ success: false, error: '画像を読み込めませんでした。時間をおいて再度お試しください。' }, { status: 503, headers }) }
}

async function readSeoImage(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
  if (!img) return NextResponse.json({ success: false, error: 'not found' }, { status: 404, headers })
  // 所有者チェック（ユーザー/ゲストで分離）
  if (userId) {
    if (String(img?.article?.userId || '') !== userId) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers })
    }
  } else {
    if (img?.article?.userId || !guestId || String(img?.article?.guestId || '') !== guestId) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401, headers })
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
    }, { status: missing ? 404 : 500, headers })
  }
  // サムネイルモード: ?thumb=1 で半分サイズのJPEGに変換（一覧表示の高速化用）
  let output = buf
  let contentType = img.mimeType || 'image/png'
  const isThumb = _req.nextUrl.searchParams.get('thumb') === '1'
  if (isThumb) {
    try {
      const meta = await sharp(buf).metadata()
      const thumbWidth = Math.round((meta.width || 800) / 2)
      const thumbBuf = await sharp(buf)
        .resize(thumbWidth)
        .jpeg({ quality: 75 })
        .toBuffer()
      output = thumbBuf
      contentType = 'image/jpeg'
    } catch {
      // sharp処理に失敗した場合はフルサイズで返す
    }
  }

  // ファイル取得・サムネイル変換の後で、現在の画像と記事の所有者を確認する。
  const current = await (prisma as any).seoImage.findFirst({
    where: {
      id: img.id, articleId: img.articleId, filePath: img.filePath, mimeType: img.mimeType,
      article: userId ? { userId } : { userId: null, guestId },
    },
    select: { id: true },
  })
  if (!current) return NextResponse.json({ success: false, error: '画像が見つかりません。' }, { status: 404, headers })
  return new NextResponse(new Uint8Array(output), { headers: { ...headers, 'Content-Type': contentType } })
}
