// POST /api/shanai/interviews/[id]/confirm-upload — アップロード完了の登録
// body: { kind: 'audio'|'photo', path, mimeType, usage?: 'thumbnail'|'body' }
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, notFound, ownInterview, unauthorized } from '@/lib/shanai/access'
import { interviewDetailDto } from '@/lib/shanai/dto'
import { getFileMetadata, isOwnPath, MAX_PHOTOS, removeFiles, validateUpload, type UploadKind } from '@/lib/shanai/storage'
import { isCuid } from '@/lib/shanai/types'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    const body = await req.json().catch(() => ({}))
    const kind: UploadKind = body.kind === 'audio' ? 'audio' : 'photo'
    const path = String(body.path || '')
    // ⚠️ 他人・他インタビューのパスを登録させない
    if (!isOwnPath(path, userId, id, kind)) return json({ error: 'アップロード先が正しくありません。' }, 400)

    const interview = await prisma.shanaiInterview.findFirst({ where: ownInterview(userId, id), include: { photos: { select: { id: true, usage: true } } } })
    if (!interview) return notFound()

    // 実際に保存された中身の大きさ・形式で検証し直す（申告値を信用しない）
    const meta = await getFileMetadata(path)
    if (!meta) return json({ error: 'アップロードされたファイルが見つかりません。もう一度お試しください。' }, 400)
    const mimeType = meta.mimeType && meta.mimeType !== 'application/octet-stream' ? meta.mimeType : String(body.mimeType || '')
    const err = validateUpload(kind, mimeType, meta.size)
    if (err) {
      await removeFiles([path])
      return json({ error: err }, 400)
    }

    if (kind === 'audio') {
      const previous = interview.audioPath
      await prisma.shanaiInterview.update({
        where: { id },
        data: { audioPath: path, audioMime: mimeType, audioSize: meta.size, transcriptStatus: 'none', transcriptError: null, transcriptJobId: null, transcriptSegments: Prisma.DbNull },
      })
      if (previous && previous !== path) await removeFiles([previous])
    } else {
      if (interview.photos.length >= MAX_PHOTOS) {
        await removeFiles([path])
        return json({ error: `写真は${MAX_PHOTOS}枚までです。` }, 400)
      }
      // 最初の1枚はサムネ用にする
      const hasThumb = interview.photos.some((p) => p.usage === 'thumbnail')
      const usage = body.usage === 'thumbnail' || !hasThumb ? 'thumbnail' : 'body'
      await prisma.$transaction(async (tx) => {
        if (usage === 'thumbnail') await tx.shanaiPhoto.updateMany({ where: { interviewId: id, usage: 'thumbnail' }, data: { usage: 'body' } })
        await tx.shanaiPhoto.create({ data: { interviewId: id, storagePath: path, mimeType, usage, sortOrder: interview.photos.length } })
      })
    }
    return json({ success: true, interview: await interviewDetailDto(id, userId) })
  } catch (e) {
    console.error('[shanai/confirm-upload] failed', (e as Error)?.name)
    return json({ error: 'アップロードの登録に失敗しました。' }, 500)
  }
}
