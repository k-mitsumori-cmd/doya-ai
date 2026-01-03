import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGuestIdFromRequest } from '@/lib/seoAccess'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()
    // NOTE:
    // ログイン済みでも、同一ブラウザで作成した「ゲスト記事/ジョブ」を閲覧できるようにするため
    // guestId は常に取得しておき、所有者判定で userId OR guestId のどちらかが一致すればOKとする。
    const guestId = getGuestIdFromRequest(_req)
    const job = await (prisma as any).seoJob.findUnique({
      where: { id },
      include: {
        article: true,
        sections: { orderBy: { index: 'asc' } },
      },
    })
    if (!job) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    // 所有者チェック（ユーザー/ゲストで分離）
    const articleUserId = String(job.article?.userId || '').trim()
    const articleGuestId = String(job.article?.guestId || '').trim()
    const canReadByUser = !!userId && !!articleUserId && articleUserId === userId
    const canReadByGuest = !!guestId && !!articleGuestId && articleGuestId === guestId
    if (!canReadByUser && !canReadByGuest) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    }

    // リサーチ実況用：直近の要約/抽出結果（SeoReference）を返す
    // NOTE: extractedTextは巨大なので返さない
    let references: any[] = []
    try {
      references = await (prisma as any).seoReference.findMany({
        where: { articleId: job.articleId },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: {
          url: true,
          title: true,
          summary: true,
          headings: true,
          insights: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    } catch {
      references = []
    }

    const jobWithRefs = { ...job, references }
    return NextResponse.json({ success: true, job: jobWithRefs })
  } catch (e: any) {
    const msg = e?.message || '不明なエラー'
    console.error('[seo job get] failed', { jobId: ctx.params.id, msg })
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}
