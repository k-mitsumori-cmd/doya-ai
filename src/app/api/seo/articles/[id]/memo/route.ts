import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGuestIdFromRequest } from '@/lib/seoAccess'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  content: z.string().max(20000),
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const id = params.id
  
  try {
    const session = await getServerSession(authOptions)
    const userId = String((session?.user as any)?.id || '').trim()
    const guestId = !userId ? getGuestIdFromRequest(req) : null
    if (!userId && !guestId) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    const owner = userId ? { userId } : { userId: null, guestId }
    await ensureSeoSchema()
    const body = BodySchema.parse(await req.json())
    const content = body.content || ''

    const article = await (prisma as any).seoArticle.update({
      where: { id, ...owner },
      data: { memo: { upsert: { create: { content }, update: { content } } } },
      select: { memo: true },
    })
    return NextResponse.json({ success: true, memo: article.memo })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    // バリデーションエラーの詳細を返す
    if (e?.name === 'ZodError') {
      const issues = e.issues?.map((issue: any) => ({
        path: issue.path?.join('.') || 'unknown',
        message: issue.message,
        code: issue.code,
      })) || []
      console.error('[seo memo] validation error', { articleId: id, issues })
      return NextResponse.json(
        { success: false, error: 'バリデーションエラー', details: issues },
        { status: 400 }
      )
    }
    console.error('[seo memo] failed', { articleId: id, error: e?.message || 'unknown error', stack: e?.stack })
    return NextResponse.json(
      { success: false, error: 'メモを保存できませんでした。時間をおいて再試行してください。' },
      { status: 500 }
    )
  }
}
