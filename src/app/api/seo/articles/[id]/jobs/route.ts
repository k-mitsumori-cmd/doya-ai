import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { z } from 'zod'

const BodySchema = z.object({
  // 予約：将来の拡張用（UIから送られても壊れない）
  autoStart: z.boolean().optional(),
})

/**
 * 記事に対して生成ジョブを作る（アウトライン編集後に「本文を生成」を押したとき用）
 */
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const _body = BodySchema.parse(await req.json().catch(() => ({})))

    const p = prisma as any
    const article = await p.seoArticle.findUnique({ where: { id }, select: { id: true } })
    if (!article) {
      return NextResponse.json({ success: false, error: '記事が見つかりません' }, { status: 404 })
    }

    const job = await p.seoJob.create({
      data: { articleId: id, status: 'queued', step: 'init', progress: 0 },
    })

    return NextResponse.json({ success: true, jobId: job.id, job })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 400 })
  }
}


