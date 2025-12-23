import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return null
  try {
    return Buffer.from(dataUrl.slice(comma + 1), 'base64')
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || ''
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const g = await prisma.generation.findUnique({
      where: { id },
      select: { output: true, metadata: true },
    })
    const meta: any = g?.metadata || {}
    const isShared = meta?.shared === true
    if (!g || !isShared) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const out = typeof g.output === 'string' ? g.output : ''
    if (!out) return NextResponse.json({ error: 'not found' }, { status: 404 })

    // もし既にURLならそのままリダイレクト（環境によっては data: ではなくURL保存の可能性がある）
    if (!out.startsWith('data:image/')) {
      if (/^https?:\/\//.test(out)) return NextResponse.redirect(out)
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const input = dataUrlToBuffer(out)
    if (!input) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const buf = await sharp(input)
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 35, mozjpeg: true })
      .toBuffer()

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

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        ETag: etag,
      },
    })
  } catch (e: any) {
    console.error('[banner thumb] failed:', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}


