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
    const guestId = !userId ? getGuestIdFromRequest(_req) : null
    const job = await (prisma as any).seoJob.findUnique({
      where: { id },
      include: {
        article: true,
        sections: { orderBy: { index: 'asc' } },
      },
    })
    if (!job) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    // 所有者チェック（ユーザー/ゲストで分離）
    if (userId) {
      if (String(job.article?.userId || '') !== userId) {
        return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
      }
    } else {
      if (!guestId || String(job.article?.guestId || '') !== guestId) {
        return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
      }
    }
    return NextResponse.json({ success: true, job })
  } catch (e: any) {
    const msg = e?.message || '不明なエラー'
    console.error('[seo job get] failed', { jobId: ctx.params.id, msg })
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}
