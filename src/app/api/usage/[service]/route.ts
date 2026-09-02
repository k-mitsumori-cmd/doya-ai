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
import { getUsageSummary } from '@/lib/usage-summary'

type Ctx = { params: Promise<{ service: string }> | { service: string } }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
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

    const summary = await getUsageSummary(service, user.id, user.plan)
    if (!summary) return NextResponse.json({ signedIn: true, summary: null })
    return NextResponse.json({ signedIn: true, summary })
  } catch (e) {
    console.error('[usage]', service, e instanceof Error ? e.message : e)
    // ⚠️ 表示だけの機能なので、失敗してもサイドバーは壊さない
    return NextResponse.json({ signedIn: true, summary: null })
  }
}
