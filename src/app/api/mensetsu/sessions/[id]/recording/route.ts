export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/mensetsu/sessions/[id]/recording — 録音の再生用URL（担当者向け）
// 署名URLは15分で失効させる。面接の録音は機微であり、URLが出回ると回収できないため。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'
import { signedRecordingUrl } from '@/lib/mensetsu/storage'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const s = await prisma.mensetsuSession.findFirst({
    where: { id: p.id, organizationId: c.organizationId },
    select: { recordingPath: true },
  })
  if (!s) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (!s.recordingPath) return NextResponse.json({ error: '録音はありません' }, { status: 404 })

  const url = await signedRecordingUrl(s.recordingPath)
  if (!url) return NextResponse.json({ error: '再生URLを発行できませんでした' }, { status: 502 })
  return NextResponse.json({ url, expiresInSec: 900 })
}
