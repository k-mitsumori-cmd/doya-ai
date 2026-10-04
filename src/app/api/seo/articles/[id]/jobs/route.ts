import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getSeoGenerationOwner, getSeoGenerationPlanForUser } from '@/lib/seoArticleOwner'
import { runSeoArticleRegenerationWithinLimit, SeoArticleNotFoundError, SeoArticleQuotaError } from '@/lib/seo-article-admission'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z
  .object({
    // 既存記事を「同条件で再生成」したいケースが多いのでデフォルトtrue
    resetSections: z.boolean().optional().default(true),
    // ジョブ画面でauto=1があるため、API内でadvanceはしない（軽量化）
    autoStart: z.boolean().optional().default(false),
  })
  .strict()

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const articleId = String(params.id || '').trim()
  
  try {
    const owner = await getSeoGenerationOwner(req)
    if (!owner) return NextResponse.json({ success: false, code: 'LOGIN_REQUIRED', error: 'この生成操作にはログインしてください。' }, { status: 401 })
    const plan = await getSeoGenerationPlanForUser(owner.userId)
    if (!plan) return NextResponse.json({ success: false, code: 'LOGIN_REQUIRED', error: 'ログイン情報を確認できません。再ログインしてください。' }, { status: 401 })
    await ensureSeoSchema()

    if (!articleId) return NextResponse.json({ success: false, error: 'invalid id' }, { status: 400 })

    const body = BodySchema.parse(await req.json())
    const job = await runSeoArticleRegenerationWithinLimit({ userId: owner.userId, articleId, plan, action: async (tx) => {
      // Claim the owned parent before resetting content or creating the new job.
      await tx.seoArticle.update({
        where: { id: articleId, ...owner },
        data: { status: 'RUNNING', ...(body.resetSections ? { finalMarkdown: null } : {}) },
        select: { id: true },
      })
      await tx.seoJob.updateMany({
        where: { articleId: articleId, supersededAt: null },
        data: { supersededAt: new Date(), executionToken: null, executionExpiresAt: null },
      })
      await tx.seoJob.updateMany({
        where: { articleId: articleId, status: { in: ['queued', 'running', 'paused', 'error'] } },
        data: { status: 'cancelled', executionToken: null, executionExpiresAt: null, finishedAt: new Date(), error: '新しい再生成ジョブに置き換えられました' },
      })
      if (body.resetSections) await tx.seoSection.deleteMany({ where: { articleId } })
      return tx.seoJob.create({
        data: { articleId, status: 'queued', step: 'init', progress: 0, error: null, cursor: 0 },
      })
    } })

    return NextResponse.json({ success: true, jobId: job.id, articleId, autoStart: body.autoStart })
  } catch (e: any) {
    if (e instanceof SeoArticleQuotaError) return NextResponse.json({ success: false, code: 'SEO_ARTICLE_LIMIT', error: `今月の生成回数の上限に達しました（${e.limit}回/月）。`, ...(e.upgradeAvailable ? { upgradeUrl: '/seo/pricing' } : { contactUrl: SUPPORT_CONTACT_URL }) }, { status: 429 })
    if (e instanceof SeoArticleNotFoundError) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (e?.code === 'P2025') return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (e instanceof SyntaxError) return NextResponse.json({ success: false, error: '入力形式が正しくありません' }, { status: 400 })
    // バリデーションエラーの詳細を返す
    if (e?.name === 'ZodError') {
      const issues = e.issues?.map((issue: any) => ({
        path: issue.path?.join('.') || 'unknown',
        message: issue.message,
        code: issue.code,
      })) || []
      console.error('[seo jobs] validation error', { articleId, issues })
      return NextResponse.json(
        { success: false, error: 'バリデーションエラー', details: issues },
        { status: 400 }
      )
    }
    // データベース接続プールエラーの特別処理
    const msg = e?.message || '不明なエラー'
    if (msg.includes('MaxClientsInSessionMode') || msg.includes('max clients reached')) {
      console.error('[seo jobs] database connection pool exhausted')
      return NextResponse.json(
        { 
          success: false, 
          error: 'データベース接続プールの上限に達しています。しばらく待ってから再試行してください。',
          hint: 'データベース接続が一時的に不足しています。数秒待ってから再試行してください。'
        },
        { status: 503 }
      )
    }
    console.error('[seo jobs] failed')
    return NextResponse.json({ success: false, error: '再生成を開始できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
