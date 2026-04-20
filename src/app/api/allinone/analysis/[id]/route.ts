/**
 * GET /api/allinone/analysis/[id]
 * 単体取得（チャット履歴含む）
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const a = await prisma.allinoneAnalysis.findUnique({
    where: { id: params.id },
    include: {
      chats: { orderBy: { createdAt: 'asc' } },
      assets: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!a) return new Response('not found', { status: 404 })
  return Response.json({ analysis: a })
}
