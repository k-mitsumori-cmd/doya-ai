import { NextRequest, NextResponse } from 'next/server'
import { advanceSeoJob } from '@seo/lib/pipeline'

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params.id
    await advanceSeoJob(id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}


