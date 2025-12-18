import { NextRequest, NextResponse } from 'next/server'
import { researchAndStore } from '@seo/lib/pipeline'

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params.id
    const result = await researchAndStore(id)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}


