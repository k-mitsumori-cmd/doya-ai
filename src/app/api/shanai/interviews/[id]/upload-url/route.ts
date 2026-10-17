// POST /api/shanai/interviews/[id]/upload-url — 録音・写真の署名付きアップロードURLを発行
// body: { kind: 'audio'|'photo', fileName, mimeType, fileSize }
// → { signedUrl, path }。ブラウザは signedUrl へ直接 PUT し、そのあと confirm-upload を呼ぶ
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, notFound, ownInterview, unauthorized } from '@/lib/shanai/access'
import { createSignedUploadUrl, MAX_PHOTOS, shanaiStoragePath, validateUpload, type UploadKind } from '@/lib/shanai/storage'
import { isCuid } from '@/lib/shanai/types'

/**
 * 1インタビューで発行できるアップロードURLの数。
 * ⚠️ 署名付きURLは発行しただけでは記録が残らず、確定（confirm-upload）しないまま置かれたファイルは
 *    写真の枚数上限にも数えられない。発行数そのものを上限で止める（写真8枚＋録音・失敗の再試行分）。
 */
const MAX_UPLOAD_URLS_PER_INTERVIEW = 40

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    const body = await req.json().catch(() => ({}))
    const kind: UploadKind = body.kind === 'audio' ? 'audio' : 'photo'
    const mimeType = String(body.mimeType || '')
    const fileSize = Number(body.fileSize)
    const err = validateUpload(kind, mimeType, fileSize)
    if (err) return json({ error: err }, 400)

    const interview = await prisma.shanaiInterview.findFirst({ where: ownInterview(userId, id), select: { id: true, mode: true, _count: { select: { photos: true } } } })
    if (!interview) return notFound()
    if (kind === 'audio' && interview.mode !== 'voice') return json({ error: 'このインタビューはアンケートで作成しています。' }, 400)
    if (kind === 'photo' && interview._count.photos >= MAX_PHOTOS) return json({ error: `写真は${MAX_PHOTOS}枚までです。` }, 400)

    const claimed = await prisma.shanaiInterview.updateMany({
      where: { ...ownInterview(userId, id), uploadUrlsIssued: { lt: MAX_UPLOAD_URLS_PER_INTERVIEW } },
      data: { uploadUrlsIssued: { increment: 1 } },
    })
    if (claimed.count === 0) return json({ error: 'このインタビューでアップロードできる回数の上限に達しました。新しいインタビューを作成してください。' }, 429)

    const path = shanaiStoragePath(userId, id, kind, String(body.fileName || ''))
    const { signedUrl } = await createSignedUploadUrl(path)
    return json({ success: true, signedUrl, path })
  } catch (e) {
    console.error('[shanai/upload-url] failed', (e as Error)?.name)
    return json({ error: 'アップロードの準備に失敗しました。' }, 500)
  }
}
