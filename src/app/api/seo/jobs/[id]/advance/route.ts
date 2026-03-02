import { NextRequest, NextResponse } from 'next/server'
import { advanceSeoJob } from '@seo/lib/pipeline'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Vercel Pro: 長文生成（統合・追記）のためタイムアウトを延長
export const maxDuration = 300

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const params = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = params.id
  
  try {
    await ensureSeoSchema()
    await advanceSeoJob(id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const msg = e?.message || '不明なエラー'
    const m = String(msg || '')
    const hint = (() => {
      if (m.includes('GOOGLE_GENAI_API_KEY') || m.includes('Gemini APIキーが設定されていません')) {
        return 'Vercelの環境変数に GOOGLE_GENAI_API_KEY（推奨）/ GOOGLE_API_KEY / GEMINI_API_KEY を設定して再デプロイしてください。'
      }
      // Google側の請求停止/課金未設定など（代表的な文言を拾う）
      if (/billing|payment|請求|課金|PERMISSION_DENIED|permission denied/i.test(m)) {
        return 'Google側の請求設定（Billing）が無効/停止している可能性があります。対象プロジェクトのBillingを有効化し、Generative Language API(Gemini)が利用可能な状態にしてから再実行してください。'
      }
      if (/quota|RESOURCE_EXHAUSTED|rate limit/i.test(m)) {
        return 'APIのクォータ/レート制限に達している可能性があります。時間を置くか、クォータを増やして再実行してください。'
      }
      // データベース接続プールエラー
      if (/MaxClientsInSessionMode|max clients reached|pool_size/i.test(m)) {
        return 'データベース接続プールの上限に達しています。しばらく待ってから再試行してください。'
      }
      return undefined
    })()
    console.error('[seo advance] failed', { jobId: id, msg, error: e, stack: e?.stack })
    return NextResponse.json(
      { success: false, error: msg, hint },
      { status: 500 }
    )
  }
}
