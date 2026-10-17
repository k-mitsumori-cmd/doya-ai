// GET /api/shanai/interviews/[id]/thumbnail — サムネイル画像（PNG 1200×630）。?download=1 で保存用
// 実写真＋文字のテンプレート合成のみ。画像生成AIは使わない（費用は発生しない）
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getShanaiUserId, json, notFound, unauthorized } from '@/lib/shanai/access'
import { buildThumbnail, loadForRender, safeFileName } from '@/lib/shanai/render-assets'
import { isCuid } from '@/lib/shanai/types'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    const data = await loadForRender(userId, id)
    if (!data) return notFound()
    const png = await buildThumbnail(data)
    const download = req.nextUrl.searchParams.get('download') === '1'
    const filename = `${safeFileName(data.interview.intervieweeName)}_thumbnail.png`
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, no-store',
        ...(download ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` } : {}),
      },
    })
  } catch (e) {
    console.error('[shanai/thumbnail] failed', (e as Error)?.name)
    return json({ error: 'サムネイルの作成に失敗しました。' }, 500)
  }
}
