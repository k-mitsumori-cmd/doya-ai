// ============================================
// /api/direct-upload/multipart/{start|parts|status|complete|abort}
// ============================================
// 大きなファイルを小分けで直接送る API。すべてログイン必須で、送信セッションは持ち主のみ操作できる。
// 利用側（動画の取り込みなど）は、プランや用途の確認を呼び出し元のルートで追加する。

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  MultipartError, abortMultipart, completeMultipart, getOwnSession, listUploadedParts,
  multipartEnabled, presignParts, startMultipart, totalPartsOf,
} from '@/lib/direct-upload/multipart'

type Ctx = { params: Promise<{ action: string }> | { action: string } }

async function handle(req: NextRequest, ctx: Ctx) {
  if (!multipartEnabled()) {
    return NextResponse.json({ success: false, error: 'この機能はまだ利用できません' }, { status: 503 })
  }
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })

  const { action } = 'then' in ctx.params ? await ctx.params : ctx.params
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    if (action === 'start') {
      const r = await startMultipart(userId, body)
      return NextResponse.json({ success: true, ...r })
    }
    const row = await getOwnSession(userId, req.method === 'GET' ? req.nextUrl.searchParams.get('id') : body?.id)
    if (action === 'parts') {
      return NextResponse.json({ success: true, urls: await presignParts(row, body?.partNumbers) })
    }
    if (action === 'status') {
      const parts = await listUploadedParts(row)
      return NextResponse.json({
        success: true, status: row.status, partSize: row.partSize, totalParts: totalPartsOf(row),
        fileName: row.fileName, fileSize: Number(row.fileSize), uploadedParts: parts,
      })
    }
    if (action === 'complete') {
      return NextResponse.json({ success: true, ...(await completeMultipart(row)) })
    }
    if (action === 'abort') {
      await abortMultipart(row)
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ success: false, error: '不明な操作です' }, { status: 404 })
  } catch (e: any) {
    if (e instanceof MultipartError) return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    console.error('[direct-upload/multipart]', action, e?.name)
    return NextResponse.json({ success: false, error: '処理に失敗しました。しばらくしてから再度お試しください。' }, { status: 503 })
  }
}

export const GET = handle
export const POST = handle
