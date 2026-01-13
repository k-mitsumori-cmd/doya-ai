import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { ensureGuestId, getGuestIdFromRequest, setGuestCookie } from '@/lib/seoAccess'

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

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const params = 'then' in ctx.params ? await ctx.params : ctx.params
  const articleId = String(params.id || '').trim()
  
  try {
    await ensureSeoSchema()

    if (!articleId) return NextResponse.json({ success: false, error: 'invalid id' }, { status: 400 })

    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()

    let guestId = getGuestIdFromRequest(req)
    if (!userId && !guestId) guestId = ensureGuestId()

    const bodyRaw = await req.json().catch(() => ({}))
    const body = BodySchema.parse(bodyRaw)

    const p = prisma as any
    const article = await p.seoArticle.findUnique({ where: { id: articleId } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    // 所有者チェック（ユーザー/ゲストで分離）
    const articleUserId = String(article?.userId || '').trim()
    const articleGuestId = String(article?.guestId || '').trim()
    const canWriteByUser = !!userId && !!articleUserId && articleUserId === userId
    const canWriteByGuest = !!guestId && !!articleGuestId && articleGuestId === guestId
    if (!canWriteByUser && !canWriteByGuest) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    }

    // 再生成時は既存セクションがあると新しいジョブに紐づかず詰まるため、基本はリセット
    if (body.resetSections) {
      try {
        await p.seoSection.deleteMany({ where: { articleId } })
      } catch (e: any) {
        // データベース接続エラーをログに記録
        if (e?.message?.includes('MaxClientsInSessionMode') || e?.message?.includes('max clients reached')) {
          console.error('[seo jobs] database connection pool exhausted', { articleId, error: e?.message })
        }
        // ignore
      }
      // 途中成果物は残して良いが、完成本文は再生成の邪魔になるのでクリア
      try {
        await p.seoArticle.update({
          where: { id: articleId },
          data: { status: 'RUNNING', finalMarkdown: null },
        })
      } catch (e: any) {
        if (e?.message?.includes('MaxClientsInSessionMode') || e?.message?.includes('max clients reached')) {
          console.error('[seo jobs] database connection pool exhausted', { articleId, error: e?.message })
        }
        // ignore
      }
    } else {
      // resetしない場合でも、ジョブ起動としてはRUNNINGにする
      try {
        await p.seoArticle.update({ where: { id: articleId }, data: { status: 'RUNNING' } })
      } catch (e: any) {
        if (e?.message?.includes('MaxClientsInSessionMode') || e?.message?.includes('max clients reached')) {
          console.error('[seo jobs] database connection pool exhausted', { articleId, error: e?.message })
        }
        // ignore
      }
    }

    const job = await p.seoJob.create({
      data: {
        articleId,
        status: 'queued',
        step: 'init',
        progress: 0,
        error: null,
        cursor: 0,
        meta: null,
      },
    })

    const res = NextResponse.json({ success: true, jobId: job.id, articleId, autoStart: body.autoStart })
    // ゲストの場合はcookieを継続
    if (!userId && guestId) setGuestCookie(res, guestId)
    return res
  } catch (e: any) {
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
      console.error('[seo jobs] database connection pool exhausted', { articleId, error: msg, stack: e?.stack })
      return NextResponse.json(
        { 
          success: false, 
          error: 'データベース接続プールの上限に達しています。しばらく待ってから再試行してください。',
          hint: 'データベース接続が一時的に不足しています。数秒待ってから再試行してください。'
        },
        { status: 503 }
      )
    }
    console.error('[seo jobs] failed', { articleId, error: msg, stack: e?.stack })
    return NextResponse.json({ success: false, error: msg }, { status: 400 })
  }
}


