import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getGuestIdFromRequest } from '@/lib/seoAccess'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const params = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = params.id
  
  try {
    await ensureSeoSchema()
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()
    const guestId = !userId ? getGuestIdFromRequest(_req) : null
    const article = await (prisma as any).seoArticle.findUnique({
      where: { id },
      include: {
        jobs: { orderBy: { createdAt: 'desc' } },
        sections: { orderBy: { index: 'asc' } },
        references: { orderBy: { createdAt: 'asc' } },
        audits: { orderBy: { createdAt: 'desc' }, take: 3 },
        memo: true,
        images: { orderBy: { createdAt: 'desc' } },
        linkChecks: { orderBy: { checkedAt: 'desc' }, take: 200 },
        knowledgeItems: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    // 所有者チェック（ユーザー/ゲストで分離）
    if (userId) {
      if (String(article.userId || '') !== userId) {
        return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
      }
    } else {
      if (!guestId || String(article.guestId || '') !== guestId) {
        return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
      }
    }
    // 比較記事の場合は候補数も含める
    const comparisonCandidates = Array.isArray(article.comparisonCandidates) ? article.comparisonCandidates : []
    const comparisonConfig = article.comparisonConfig || null
    const comparisonCount = comparisonCandidates.length

    return NextResponse.json({
      success: true,
      article: {
        ...article,
        comparisonCount,
        comparisonCandidates,
        comparisonConfig,
      },
    })
  } catch (e: any) {
    const msg = e?.message || '不明なエラー'
    console.error('[seo article get] failed', { articleId: id, msg, error: e })
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}
