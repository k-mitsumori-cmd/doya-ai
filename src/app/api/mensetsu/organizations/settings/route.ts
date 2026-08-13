export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// PATCH /api/mensetsu/organizations/settings — 組織設定（F5-4）
// ⚠️ recordAudio / retentionDays は応募者への同意文面に直結する。
//    変更は admin 以上に限る。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, hasMinRole, orgSlugFrom } from '@/lib/mensetsu/access'

export async function PATCH(req: NextRequest) {
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'admin')) {
    return NextResponse.json({ error: '設定を変更する権限がありません' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const data: any = {}
  if (typeof body?.recordAudio === 'boolean') data.recordAudio = body.recordAudio
  // ⚠️ recordVideo は受け付けない。映像の収録は廃止した（列は非破壊のため残置）
  if (typeof body?.discloseToCandidate === 'boolean') data.discloseToCandidate = body.discloseToCandidate
  if (Number.isFinite(Number(body?.retentionDays))) {
    // 1日未満・3年超は事故のもと。個人情報を必要以上に持たないための上限でもある。
    data.retentionDays = Math.min(1095, Math.max(1, Math.round(Number(body.retentionDays))))
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '変更内容がありません' }, { status: 400 })
  }

  const org = await prisma.mensetsuOrganization.update({
    where: { id: c.organizationId },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      recordAudio: true,
      retentionDays: true,
      discloseToCandidate: true,
    },
  })
  return NextResponse.json({ organization: org })
}
