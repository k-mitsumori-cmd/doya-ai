import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

const BodySchema = z.object({
  content: z.string().max(20000),
})

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const body = BodySchema.parse(await req.json())
    const content = body.content || ''

    const memo = await (prisma as any).seoUserMemo.upsert({
      where: { articleId: id },
      create: { articleId: id, content },
      update: { content },
    })
    return NextResponse.json({ success: true, memo })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 400 }
    )
  }
}


