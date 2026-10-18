// PATCH/DELETE /api/shanai/interviews/[id]/photos/[photoId] — 写真の用途・キャプション変更、削除
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, notFound, ownInterview, unauthorized } from '@/lib/shanai/access'
import { interviewDetailDto } from '@/lib/shanai/dto'
import { removeFiles } from '@/lib/shanai/storage'
import { clip, isCuid } from '@/lib/shanai/types'

type Ctx = { params: Promise<{ id: string; photoId: string }> }

async function findPhoto(userId: string, id: string, photoId: string) {
  if (!isCuid(id) || !isCuid(photoId)) return null
  const interview = await prisma.shanaiInterview.findFirst({ where: ownInterview(userId, id), select: { id: true } })
  if (!interview) return null
  return prisma.shanaiPhoto.findFirst({ where: { id: photoId, interviewId: id } })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id, photoId } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    const photo = await findPhoto(userId, id, photoId)
    if (!photo) return notFound()
    const body = await req.json().catch(() => ({}))
    await prisma.$transaction(async (tx) => {
      if (body.usage === 'thumbnail') await tx.shanaiPhoto.updateMany({ where: { interviewId: id, usage: 'thumbnail' }, data: { usage: 'body' } })
      await tx.shanaiPhoto.update({
        where: { id: photo.id },
        data: {
          ...(body.usage === 'thumbnail' || body.usage === 'body' ? { usage: body.usage } : {}),
          ...(body.caption !== undefined ? { caption: clip(body.caption, 100) } : {}),
        },
      })
    })
    return json({ success: true, interview: await interviewDetailDto(id, userId) })
  } catch (e) {
    console.error('[shanai/photo][PATCH] failed', (e as Error)?.name)
    return json({ error: '写真の更新に失敗しました。' }, 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id, photoId } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    const photo = await findPhoto(userId, id, photoId)
    if (!photo) return notFound()
    await prisma.shanaiPhoto.delete({ where: { id: photo.id } })
    await removeFiles([photo.storagePath])
    return json({ success: true, interview: await interviewDetailDto(id, userId) })
  } catch (e) {
    console.error('[shanai/photo][DELETE] failed', (e as Error)?.name)
    return json({ error: '写真の削除に失敗しました。' }, 500)
  }
}
