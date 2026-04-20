/**
 * GET /api/allinone/analysis
 * 履歴一覧（自分のもの）
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  const guestId = req.cookies.get('doya_allinone_guest')?.value

  const where =
    userId ? { userId } : guestId ? { guestId } : { id: '__none__' }

  const items = await prisma.allinoneAnalysis.findMany({
    where,
    select: {
      id: true,
      url: true,
      title: true,
      description: true,
      favicon: true,
      heroImage: true,
      ogImage: true,
      overallScore: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return Response.json({ items })
}
