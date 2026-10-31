// POST /api/shanai/interviews/[id]/confirm-upload — アップロード完了の登録
// body: { kind: 'audio'|'photo', path, mimeType, usage?: 'thumbnail'|'body' }
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, notFound, ownInterview, unauthorized } from '@/lib/shanai/access'
import { interviewDetailDto } from '@/lib/shanai/dto'
import { getFileMetadata, isOwnPath, MAX_PHOTOS, validateUpload, type UploadKind } from '@/lib/shanai/storage'
import { enqueueShanaiFileStoragePurge, isShanaiFileRetired, lockShanaiStorage } from '@/lib/shanai/storage-purge'
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

    const interview = await prisma.shanaiInterview.findFirst({ where: ownInterview(userId, id), select: { id: true } })
    if (!interview) return notFound()

    // 実際に保存された中身の大きさ・形式で検証し直す（申告値を信用しない）
    const meta = await getFileMetadata(path)
    if (!meta) return json({ error: 'アップロードされたファイルが見つかりません。もう一度お試しください。' }, 400)
    const mimeType = meta.mimeType && meta.mimeType !== 'application/octet-stream' ? meta.mimeType : String(body.mimeType || '')
    const err = validateUpload(kind, mimeType, meta.size)
    const outcome = await prisma.$transaction(async tx => {
      await lockShanaiStorage(tx, id)
      const current = await tx.shanaiInterview.findFirst({
        where: ownInterview(userId, id),
        include: { photos: { select: { id: true, usage: true, storagePath: true } } },
      })
      if (!current) return 'missing' as const
      if (await isShanaiFileRetired(tx, path)) return 'retired' as const
      const existingPhoto = current.photos.find(photo => photo.storagePath === path)
      if (err) {
        if (current.audioPath !== path && !existingPhoto) await enqueueShanaiFileStoragePurge(tx, current, path)
        return { error: err }
      }
      if (kind === 'audio') {
        // 同じ確定要求の再送で、完了済みの文字起こしを消さない。
        if (current.audioPath === path) return 'saved' as const
        if (current.audioPath) await enqueueShanaiFileStoragePurge(tx, current, current.audioPath)
        await tx.shanaiInterview.update({
          where: { id },
          data: { audioPath: path, audioMime: mimeType, audioSize: meta.size, audioDurationSec: null, transcriptStatus: 'none', transcriptError: null, transcriptJobId: null, transcriptSegments: Prisma.DbNull },
        })
      } else {
        if (existingPhoto) return 'saved' as const
        if (current.photos.length >= MAX_PHOTOS) {
          await enqueueShanaiFileStoragePurge(tx, current, path)
          return { error: `写真は${MAX_PHOTOS}枚までです。` }
        }
        const hasThumb = current.photos.some(photo => photo.usage === 'thumbnail')
        const usage = body.usage === 'thumbnail' || !hasThumb ? 'thumbnail' : 'body'
        if (usage === 'thumbnail') await tx.shanaiPhoto.updateMany({ where: { interviewId: id, usage: 'thumbnail' }, data: { usage: 'body' } })
        await tx.shanaiPhoto.create({ data: { interviewId: id, storagePath: path, mimeType, usage, sortOrder: current.photos.length } })
      }
      return 'saved' as const
    })
    if (outcome === 'missing') return notFound()
    if (outcome === 'retired') return json({ error: 'このファイルは削除処理中です。ファイルを選び直してアップロードしてください。' }, 409)
    if (typeof outcome === 'object') return json(outcome, 400)
    return json({ success: true, interview: await interviewDetailDto(id, userId) })
  } catch (e) {
    console.error('[shanai/confirm-upload] failed', (e as Error)?.name)
    return json({ error: 'アップロードの登録に失敗しました。' }, 500)
  }
}
