import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 1x1 透明PNG（プレースホルダー）
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return null
  try {
    return Buffer.from(dataUrl.slice(comma + 1), 'base64')
  } catch {
    return null
  }
}

// sharpは動的にインポート（Vercel環境での互換性向上）
async function resizeImage(input: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default
    return await sharp(input)
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 35, mozjpeg: true })
      .toBuffer()
  } catch (e) {
    console.error('[thumb] sharp resize failed:', e)
    // sharpが失敗したら元の画像をそのまま返す（サイズは大きいがエラーより良い）
    return input
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || ''
    if (!id) {
      return new NextResponse(PLACEHOLDER_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
      })
    }

    const g = await prisma.generation.findUnique({
      where: { id },
      select: { output: true, metadata: true },
    })
    const meta: any = g?.metadata || {}
    const isShared = meta?.shared === true
    if (!g || !isShared) {
      return new NextResponse(PLACEHOLDER_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
      })
    }

    const out = typeof g.output === 'string' ? g.output : ''
    if (!out) {
      return new NextResponse(PLACEHOLDER_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
      })
    }

    // もし既にURLならそのままリダイレクト（環境によっては data: ではなくURL保存の可能性がある）
    if (!out.startsWith('data:image/')) {
      if (/^https?:\/\//.test(out)) return NextResponse.redirect(out)
      return new NextResponse(PLACEHOLDER_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
      })
    }

    const input = dataUrlToBuffer(out)
    if (!input) {
      return new NextResponse(PLACEHOLDER_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
      })
    }

    const buf = await resizeImage(input)

    const etag = `W/"thumb-${id}"`
    if (req.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      })
    }

    // sharpで変換成功したらJPEG、失敗してそのままならPNG/元形式
    const contentType = buf === input ? 'image/png' : 'image/jpeg'

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        ETag: etag,
      },
    })
  } catch (e: any) {
    console.error('[banner thumb] failed:', e)
    // エラーでもプレースホルダー画像を返す（imgタグが壊れないように）
    return new NextResponse(PLACEHOLDER_PNG, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
    })
  }
}


