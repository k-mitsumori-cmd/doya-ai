import { NextRequest, NextResponse } from 'next/server'
import { runSeoAudit } from '@seo/lib/audit'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const result = await runSeoAudit(id)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}
