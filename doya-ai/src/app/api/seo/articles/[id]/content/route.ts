import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { extractOutlineFromMarkdown, normalizePlaintextToMarkdown } from '@seo/lib/markdown'
import { z } from 'zod'

const BodySchema = z.object({
  finalMarkdown: z.string().max(2_000_000),
  normalize: z.boolean().optional().default(false),
  updateOutline: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const body = BodySchema.parse(await req.json())

    const md = body.normalize ? normalizePlaintextToMarkdown(body.finalMarkdown) : body.finalMarkdown
    const outline = body.updateOutline ? extractOutlineFromMarkdown(md) : undefined

    const article = await (prisma as any).seoArticle.update({
      where: { id },
      data: {
        finalMarkdown: md,
        ...(outline !== undefined ? { outline } : {}),
      },
    })

    return NextResponse.json({ success: true, article })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 400 })
  }
}



