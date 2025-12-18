import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { autoFixFromAudit } from '@seo/lib/audit'

const BodySchema = z.object({
  auditId: z.string().optional(),
})

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params.id
    const body = BodySchema.parse(await req.json().catch(() => ({})))
    await autoFixFromAudit(id, body.auditId)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}


