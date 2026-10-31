// DELETE /api/stored-files/{id} — 自分のファイルを保存場所から消す（合計はすぐ減る）
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteStoredFile } from '@/lib/direct-upload/stored-files'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
  const { id } = await ctx.params
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return NextResponse.json({ success: false, error: 'IDが不正です' }, { status: 400 })
  const r = await deleteStoredFile(userId, id)
  if (r === 'not_found') return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
  if (r === 'failed') return NextResponse.json({ success: false, error: '削除に失敗しました。しばらくしてから再度お試しください' }, { status: 503 })
  return NextResponse.json({ success: true })
}
