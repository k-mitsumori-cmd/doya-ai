// GET /api/shanai/interviews/[id]/export — 最新の記事を Word（.docx）でダウンロード
// サムネ・本文の写真入り。Googleドキュメントで使う場合は、このファイルをドライブで開く
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getShanaiUserId, json, notFound, unauthorized } from '@/lib/shanai/access'
import { buildArticleDocx } from '@/lib/shanai/docx'
import { buildThumbnail, loadForRender, safeFileName } from '@/lib/shanai/render-assets'
import { downloadFile } from '@/lib/shanai/storage'
import { isCuid, type ArticleBlock } from '@/lib/shanai/types'
import { recordServiceUsage } from '@/lib/service-usage'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    const data = await loadForRender(userId, id)
    if (!data) return notFound()
    if (!data.article) return json({ error: '先に記事を作成してください。' }, 400)

    const { interview, article, company } = data
    const bodyPhotos = []
    for (const p of interview.photos.filter((x) => x.usage !== 'thumbnail').slice(0, 6)) {
      const buf = await downloadFile(p.storagePath)
      if (buf) bodyPhotos.push({ data: buf, caption: p.caption })
    }
    const thumbnail = await buildThumbnail(data).catch(() => null)
    const profileLine = [interview.department, interview.position, interview.joinYear && `${interview.joinYear}入社`, interview.intervieweeName].filter(Boolean).join(' / ')

    const docx = await buildArticleDocx({
      title: article.title,
      lead: article.lead,
      blocks: (article.blocks as unknown as ArticleBlock[]) || [],
      intervieweeName: interview.intervieweeName,
      profileLine,
      companyName: company?.name || '',
      thumbnail,
      photos: bodyPhotos,
    })
    void recordServiceUsage({ userId, serviceId: 'shanai', action: 'Wordで書き出し', summary: article.title })
    const filename = `${safeFileName(interview.intervieweeName)}_社員インタビュー.docx`
    return new NextResponse(new Uint8Array(docx), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('[shanai/export] failed', (e as Error)?.name)
    return json({ error: 'Wordファイルの作成に失敗しました。' }, 500)
  }
}
