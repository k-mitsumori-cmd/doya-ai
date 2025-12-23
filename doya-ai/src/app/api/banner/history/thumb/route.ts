import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || ''
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const g = await prisma.generation.findFirst({
      where: {
        id,
        userId,
        serviceId: 'banner',
        outputType: 'IMAGE',
      },
      select: { output: true },
    })

    const out = typeof g?.output === 'string' ? g.output : ''
    if (!out || !out.startsWith('data:image/')) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const input = dataUrlToBuffer(out)
    if (!input) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const buf = await sharp(input)
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 35, mozjpeg: true })
      .toBuffer()

    const etag = `W/"hist-thumb-${id}"`
    if (req.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'private, max-age=60',
        },
      })
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=60',
        ETag: etag,
      },
    })
  } catch (e: any) {
    console.error('[banner history thumb] failed:', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}


