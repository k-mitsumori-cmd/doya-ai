import { NextRequest, NextResponse } from 'next/server'
import { researchAndStore } from '@seo/lib/pipeline'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const params = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = params.id
  
  try {
    await ensureSeoSchema()
    const result = await researchAndStore(id)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    console.error('[seo research] failed', { articleId: id, error: e?.message || 'unknown error', stack: e?.stack })
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}
