import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    if (!g || !isShared) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    const image = typeof g.output === 'string' ? g.output : ''
    if (!image) return NextResponse.json({ error: 'no image' }, { status: 404 })

    return NextResponse.json(
      { image },
      {
        headers: {
          // 公開画像：頻繁に変わらないので長めキャッシュ
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    )
  } catch (e: any) {
    console.error('[banner image] failed:', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}


