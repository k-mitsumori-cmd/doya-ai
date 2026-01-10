import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { ensureGuestId, getGuestIdFromRequest, setGuestCookie } from '@/lib/seoAccess'

export const runtime = 'nodejs'

const BodySchema = z
  .object({
    // 既存記事を「同条件で再生成」したいケースが多いのでデフォルトtrue
    resetSections: z.boolean().optional().default(true),
    // ジョブ画面でauto=1があるため、API内でadvanceはしない（軽量化）
    autoStart: z.boolean().optional().default(false),
  })
  .strict()

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()

    const articleId = String(ctx.params.id || '').trim()
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
      } catch {
        // ignore
      }
      // 途中成果物は残して良いが、完成本文は再生成の邪魔になるのでクリア
      try {
        await p.seoArticle.update({
          where: { id: articleId },
          data: { status: 'RUNNING', finalMarkdown: null },
        })
      } catch {
        // ignore
      }
    } else {
      // resetしない場合でも、ジョブ起動としてはRUNNINGにする
      try {
        await p.seoArticle.update({ where: { id: articleId }, data: { status: 'RUNNING' } })
      } catch {
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
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 400 })
  }
}
