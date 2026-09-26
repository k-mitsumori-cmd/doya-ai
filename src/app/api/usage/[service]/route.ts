export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================
// サイドバーに出す使用状況（全サービス共通）
// ============================================
// 読み取り専用。数え方と上限は src/lib/usage-summary.ts に集約している。
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAioContext, orgSlugFrom } from '@/lib/aio/access'
import { getAioUsage } from '@/lib/aio/usage'
import { getUsageSummary } from '@/lib/usage-summary'

type Ctx = { params: Promise<{ service: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const service = String(p.service || '').trim()

  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email
    const sid = (session?.user as any)?.id as string | undefined
    if (!sid && !email) return NextResponse.json({ signedIn: false })

    const user = await prisma.user.findFirst({
      where: sid ? { id: sid } : { email: email as string },
      select: { id: true, plan: true },
    })
    if (!user) return NextResponse.json({ signedIn: false })

    if (service === 'aio') {
      const aio = await getAioContext(orgSlugFrom(_req))
      if (!aio) return NextResponse.json({ error: '組織にアクセスできません', summary: null }, { status: 403 })
      const summary = await getAioUsage(aio.organizationId)
      if (!summary) return NextResponse.json({ error: '組織の契約情報を確認できません', summary: null }, { status: 409 })
      return NextResponse.json({ signedIn: true, summary }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    const orgSlug = new URL(_req.url).searchParams.get('org')?.trim() || undefined
    const summary = await getUsageSummary(service, user.id, user.plan, orgSlug)
    if (!summary && orgSlug && ['mensetsu', 'aishodan', 'quote', 'shodan'].includes(service)) {
      return NextResponse.json({ error: '組織にアクセスできません', summary: null }, { status: 403 })
    }
    if (!summary) return NextResponse.json({ signedIn: true, summary: null })
    return NextResponse.json({ signedIn: true, summary }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    console.error('[usage]', service, e instanceof Error ? e.message : e)
    // ⚠️ 表示だけの機能なので、失敗してもサイドバーは壊さない
    return NextResponse.json({ signedIn: true, summary: null })
  }
}
