import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  await ensureSeoSchema()
  const id = ctx.params.id
  const job = await (prisma as any).seoJob.findUnique({
    where: { id },
    include: {
      article: true,
      sections: { orderBy: { index: 'asc' } },
    },
  })
  if (!job) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
  return NextResponse.json({ success: true, job })
}


