export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/mensetsu/company — いま登録されている会社情報（最新の1件）
//
// ⚠️ 会社URLを入れる場所が画面のどこにも無く、
//    /api/mensetsu/company/analyze はどこからも呼ばれていなかった（2026-09-02）。
//    質問セットは会社情報を踏まえて作るため、未登録だと一般論しか出てこない。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'

export async function GET(req: NextRequest) {
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const profile = await prisma.mensetsuCompanyProfile.findFirst({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      sourceUrl: true,
      companyName: true,
      business: true,
      valueProp: true,
      culture: true,
      idealProfile: true,
      updatedAt: true,
    },
  })
  return NextResponse.json({ profile })
}
