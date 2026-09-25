import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGuestIdFromRequest } from '@/lib/seoAccess'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'

const BodySchema = z.object({
  finalMarkdown: z.string().optional(),
  outline: z.string().optional(),
  normalize: z.boolean().optional().default(false),
})

function normalizeMd(md: string) {
  const t = String(md || '').replace(/\r\n/g, '\n')
  // 末尾の空白行を詰める（最低1行の改行は残す）
  return t.replace(/[ \t]+$/gm, '').replace(/\n{4,}/g, '\n\n\n').trim() + '\n';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = String((session?.user as any)?.id || '').trim()
    const guestId = !userId ? getGuestIdFromRequest(req) : null
    if (!userId && !guestId) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    const owner = userId ? { userId } : { userId: null, guestId }
    await ensureSeoSchema()
    const id = (await ctx.params).id
    const body = BodySchema.parse(await req.json().catch(() => ({})))

    const exists = await (prisma as any).seoArticle.findFirst({ where: { id, ...owner }, select: { id: true } })
    if (!exists) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    const data: any = {}
    if (typeof body.finalMarkdown === 'string') {
      data.finalMarkdown = body.normalize ? normalizeMd(body.finalMarkdown) : body.finalMarkdown
    }
    if (typeof body.outline === 'string') {
      data.outline = body.outline
    }
    if (!Object.keys(data).length) {
      return NextResponse.json({ success: false, error: '更新内容がありません' }, { status: 400 })
    }

    const updated = await (prisma as any).seoArticle.update({
      where: { id, ...owner },
      data: { ...data, updatedAt: new Date() },
      select: { id: true, finalMarkdown: true, outline: true },
    })

    return NextResponse.json({ success: true, article: updated })
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: '入力内容が不正です' }, { status: 400 })
    if (e?.code === 'P2025') return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    console.error('[seo articles/[id]/content/route.ts] failed', e)
    return NextResponse.json({ success: false, error: '記事を保存できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
