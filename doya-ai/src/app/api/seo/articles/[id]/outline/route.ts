import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getGuestIdFromRequest } from '@/lib/seoAccess'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  outline: z.string().max(50000).optional(),
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const params = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = params.id
  
  try {
    await ensureSeoSchema()
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()
    const guestId = !userId ? getGuestIdFromRequest(req) : null
    
    // 記事の存在確認と所有者チェック
    const article = await (prisma as any).seoArticle.findUnique({
      where: { id },
    })
    if (!article) {
      return NextResponse.json({ success: false, error: '記事が見つかりません' }, { status: 404 })
    }
    if (userId) {
      if (String(article.userId || '') !== userId) {
        return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
      }
    } else {
      if (!guestId || String(article.guestId || '') !== guestId) {
        return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
      }
    }
    
    const body = BodySchema.parse(await req.json())
    const outline = body.outline || ''
    
    await (prisma as any).seoArticle.update({
      where: { id },
      data: { outline },
    })
    
    return NextResponse.json({ success: true })
  } catch (e: any) {
    // バリデーションエラーの詳細を返す
    if (e?.name === 'ZodError') {
      const issues = e.issues?.map((issue: any) => ({
        path: issue.path?.join('.') || 'unknown',
        message: issue.message,
        code: issue.code,
      })) || []
      console.error('[seo outline] validation error', { articleId: id, issues })
      return NextResponse.json(
        { success: false, error: 'バリデーションエラー', details: issues },
        { status: 400 }
      )
    }
    console.error('[seo outline] failed', { articleId: id, error: e?.message || 'unknown error', stack: e?.stack })
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}


