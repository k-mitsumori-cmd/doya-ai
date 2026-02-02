import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    const image = typeof g?.output === 'string' ? g.output : ''
    if (!image) return NextResponse.json({ error: 'not found' }, { status: 404 })

    return NextResponse.json(
      { image },
      {
        headers: {
          // 個人履歴なので private のみ。短時間のブラウザキャッシュは許可。
          'Cache-Control': 'private, max-age=60',
        },
      }
    )
  } catch (e: any) {
    console.error('[banner history image] failed', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}


