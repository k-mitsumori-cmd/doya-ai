import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { z } from 'zod'

const BodySchema = z.object({
  outline: z.string().max(200000),
})

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const body = BodySchema.parse(await req.json())

    const article = await (prisma as any).seoArticle.update({
      where: { id },
      data: { outline: body.outline },
    })

    return NextResponse.json({ success: true, article })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 400 })
  }
}




