import { NextRequest, NextResponse } from 'next/server'
import { advanceSeoJob } from '@seo/lib/pipeline'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    await advanceSeoJob(id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const msg = e?.message || '不明なエラー'
    const hint =
      typeof msg === 'string' && msg.includes('GOOGLE_GENAI_API_KEY')
        ? 'Vercelの環境変数に GOOGLE_GENAI_API_KEY を設定して再デプロイしてください。'
        : undefined
    console.error('[seo advance] failed', { jobId: ctx.params.id, msg })
    return NextResponse.json(
      { success: false, error: msg, hint },
      { status: 500 }
    )
  }
}
