export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPopupUserId, ownPopup } from '@/lib/popup/access'
import { isId, sanitizeCreative, type PopupCreative } from '@/lib/popup/schema'
import { MAX_IMAGE_BYTES, saveImage } from '@/lib/popup/storage'
import { toPopupDto } from '@/lib/popup/dto'

type Ctx = { params: Promise<{ id: string }> }

/** 画像のアップロード（multipart の file）。画像型の案だけ */
export async function POST(req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })
  const popup = await prisma.popup.findFirst({ where: ownPopup(userId, id) })
  if (!popup) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })
  if (popup.kind !== 'image') return NextResponse.json({ error: '画像を使えるのは画像のポップアップだけです。' }, { status: 400 })

  // ⚠️ 本文の大きさを読む前に確かめる（巨大な本文でメモリを使わせない）
  const len = Number(req.headers.get('content-length') || 0)
  if (len > MAX_IMAGE_BYTES + 64 * 1024) return NextResponse.json({ error: '画像は2MBまでです。' }, { status: 413 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ error: '画像を選んでください。' }, { status: 400 })
  const buf = Buffer.from(await file.arrayBuffer())
  const saved = await saveImage(userId, popup.id, buf)
  if ('error' in saved) return NextResponse.json({ error: saved.error }, { status: 400 })

  const current = popup.creative as unknown as PopupCreative
  const creative = sanitizeCreative(current, { ...current, imagePath: saved.path, imageWidth: saved.width, imageHeight: saved.height })
  const updated = await prisma.popup.update({ where: { id: popup.id }, data: { creative: creative as any } })
  return NextResponse.json({ popup: toPopupDto(updated) })
}
