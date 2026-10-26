// ============================================
// ドヤパワーが足りないときの導線に使う、この人の区分 /api/pricing/upsell
// ============================================
// ⚠️ 旗 NEW_PRICING_ROLLOUT の内側。off なら 404（画面は今までの「プランを見る」のまま）。読むだけ。
// 返すもの: kind（free / team / legacy）・会社の持ち主か・チームの人数・追加購入とチームの申し込みが使えるか・はじめの付与を受け取った日時。
// 文言と行き先は src/lib/pricing-v2/upsell.ts の decideUpsell()（クライアントで組み立てる）。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isNewPricingEnabledFor } from '@/lib/pricing-v2/rollout'
import { newPricingPriceIds, powerPackPriceId, teamPriceConfig } from '@/lib/pricing-v2/prices'
import { subscriberKind } from '@/lib/pricing-v2/view'
import { resolveCompanyForUser, teamSeatsForCompany } from '@/lib/pricing-v2/team.server'
import { doyaPowerLedgerAllowed } from '@/lib/doya-power/flag'
import { starterTablesAllowed } from '@/lib/pricing-v2/starter.server'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    const email = session?.user?.email ?? null
    if (!userId || !email) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401, headers: NO_STORE })
    if (!isNewPricingEnabledFor(email)) return NextResponse.json({ error: '見つかりません。' }, { status: 404, headers: NO_STORE })
    const company = await resolveCompanyForUser(userId)
    // 区分は会社の持ち主の契約で決める（メンバーは持ち主の会社のドヤパワーを使う）
    const ownerId = company?.role === 'member'
      ? (await prisma.accountCompany.findUnique({ where: { id: company.companyId }, select: { userId: true } }))?.userId ?? userId
      : userId
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { plan: true, stripePriceId: true } })
    const k = subscriberKind({ plan: owner?.plan, stripePriceId: owner?.stripePriceId, newPriceIds: newPricingPriceIds() })
    const kind = k === 'none' ? 'free' : k
    const isOwner = !company || company.role === 'owner'
    return NextResponse.json({
      kind,
      isOwner,
      seats: kind === 'team' && company ? await teamSeatsForCompany(company.companyId) : null,
      canBuyPack: kind !== 'free' && isOwner && Boolean(powerPackPriceId()) && doyaPowerLedgerAllowed(),
      canCheckoutTeam: teamPriceConfig().ok,
      // はじめの付与（最初の100）を受け取った日時（ようこその知らせに使う）。表を使えないときは null
      starter: isOwner && starterTablesAllowed() && doyaPowerLedgerAllowed()
        ? await prisma.doyaPowerStarterClaim.findUnique({ where: { userId }, select: { amount: true, createdAt: true } }).then((c) => (c ? { amount: c.amount, at: c.createdAt.toISOString() } : null))
        : null,
    }, { headers: NO_STORE })
  } catch {
    console.error('[pricing/upsell] could not read')
    return NextResponse.json({ error: '読み込めませんでした。' }, { status: 503, headers: NO_STORE })
  }
}
