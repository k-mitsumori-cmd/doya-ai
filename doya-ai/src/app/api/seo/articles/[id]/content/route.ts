import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
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
  return t.replace(/[ \t]+$/gm, '').replace(/\n{4,}/g, '\n\n\n').trim() + '\n'
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const body = BodySchema.parse(await req.json().catch(() => ({})))

    const exists = await (prisma as any).seoArticle.findUnique({ where: { id }, select: { id: true } })
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
      where: { id },
      data: { ...data, updatedAt: new Date() },
      select: { id: true, finalMarkdown: true, outline: true },
    })

    return NextResponse.json({ success: true, article: updated })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}
