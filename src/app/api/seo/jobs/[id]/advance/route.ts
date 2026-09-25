import { prisma } from '@/lib/prisma'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'
import { NextRequest, NextResponse } from 'next/server'
import { advanceSeoJob } from '@seo/lib/pipeline'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Vercel Pro: 長文生成（統合・追記）のためタイムアウトを延長
export const maxDuration = 300

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const id = params.id
  
  try {
    const owner = await getSeoArticleOwner(_req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })
    await ensureSeoSchema()
    const job = await prisma.seoJob.findFirst({ where: { id, article: owner }, select: { id: true } })
    if (!job) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    await advanceSeoJob(id, owner)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ success: false, error: 'ジョブの状態またはアクセス権が変わりました。再読み込みしてください。' }, { status: 409 })
    const msg = e?.message || '不明なエラー'
    const m = String(msg || '')
    const hint = (() => {
      if (m.includes('GOOGLE_GENAI_API_KEY') || m.includes('Gemini APIキーが設定されていません')) {
        return '生成サービスの設定を確認しています。時間をおいて再試行してください。'
      }
      // Google側の請求停止/課金未設定など（代表的な文言を拾う）
      if (/billing|payment|請求|課金|PERMISSION_DENIED|permission denied/i.test(m)) {
        return '生成サービスを利用できない状態です。時間をおいて再試行してください。'
      }
      if (/quota|RESOURCE_EXHAUSTED|rate limit/i.test(m)) {
        return 'APIのクォータ/レート制限に達している可能性があります。時間を置くか、クォータを増やして再実行してください。'
      }
      // データベース接続プールエラー
      if (/MaxClientsInSessionMode|max clients reached|pool_size/i.test(m)) {
        return '一時的に混み合っています。時間をおいて再試行してください。'
      }
      return undefined
    })()
    console.error('[seo advance] failed', { jobId: id, msg, error: e, stack: e?.stack })
    return NextResponse.json(
      { success: false, error: '生成処理を進められませんでした。時間をおいて再試行してください。', hint },
      { status: 500 }
    )
  }
}
