export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPopupUserId, ownPopup } from '@/lib/popup/access'
import { isId } from '@/lib/popup/schema'
import { getPopupForEdit } from '@/lib/popup/popup-read'
import { updatePopup } from '@/lib/popup/popup-write'

type Ctx = { params: Promise<{ id: string }> }

const NOT_FOUND = { error: '見つかりません。' }

/** 案の詳細と、編集画面で使うサイトの情報（リンク候補・設置タグ）。正本は popup-read.ts */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json(NOT_FOUND, { status: 404 })
  const data = await getPopupForEdit(prisma, userId, id)
  if (!data) return NextResponse.json(NOT_FOUND, { status: 404 })
  return NextResponse.json(data)
}

/** 編集・公開の切り替え。検査と保存の正本は popup-write.ts（エージェントの popup.publish と同じ関数） */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json(NOT_FOUND, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const r = await updatePopup(userId, id, body && typeof body === 'object' ? body : {})
  if (r.ok) return NextResponse.json({ popup: r.popup })
  if (r.status === 404) return NextResponse.json(NOT_FOUND, { status: 404 })
  return NextResponse.json({ error: r.error, issues: r.issues, chars: r.chars, urlLength: r.urlLength }, { status: 422 })
}

/** 削除（集計も一緒に消える）。画像は Storage に残る（同じ画像を複製した案が使っていることがある） */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json(NOT_FOUND, { status: 404 })
  const popup = await prisma.popup.findFirst({ where: ownPopup(userId, id), select: { id: true } })
  if (!popup) return NextResponse.json(NOT_FOUND, { status: 404 })
  await prisma.popup.deleteMany({ where: { id: popup.id, userId } })
  return NextResponse.json({ ok: true })
}
