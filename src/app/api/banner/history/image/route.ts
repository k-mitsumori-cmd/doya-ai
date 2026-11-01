import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bannerHistoryCutoff } from '@/lib/banner/history-access'
import { privateApiJson } from '@/lib/private-api-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return privateApiJson({ error: 'unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || ''
    if (!id) return privateApiJson({ error: 'id is required' }, { status: 400 })
    const cutoffDate = await bannerHistoryCutoff(userId, (session?.user as any)?.firstLoginAt)
    if (!cutoffDate) return privateApiJson({ error: 'not found' }, { status: 404 })

    const g = await prisma.generation.findFirst({
      where: {
        id,
        userId,
        serviceId: 'banner',
        outputType: 'IMAGE',
        createdAt: { gte: cutoffDate },
      },
      select: { output: true },
    })
    const image = typeof g?.output === 'string' ? g.output : ''
    if (!image) return privateApiJson({ error: 'not found' }, { status: 404 })

    return privateApiJson({ image })
  } catch (e: any) {
    console.error('[banner history image] failed')
    return privateApiJson({ error: 'failed' }, { status: 500 })
  }
}

