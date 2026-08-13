export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST  /api/mensetsu/live/[token]/recording — 署名付きアップロードURLを発行
// PATCH /api/mensetsu/live/[token]/recording — アップロード完了を記録
//
// 音声はブラウザから Supabase へ直接送る（サーバ経由だと Vercel の本文上限4.5MBに当たる）。
// ⚠️ 組織設定 recordAudio が OFF の場合は発行しない。同意していない録音を作らないため。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertUsable, loadSessionByToken } from '@/lib/mensetsu/public'
import { createSignedUploadUrl, recordingExists } from '@/lib/mensetsu/storage'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

function pathFor(sessionId: string) {
  return `sessions/${sessionId}/interview.webm`
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (!s.consentedAt) return NextResponse.json({ error: '同意が必要です' }, { status: 403 })
  // ⚠️ 音声・映像のどちらかが有効なら発行する。映像だけ有効な設定もありうる
  if (!s.organization.recordAudio) {
    return NextResponse.json({ error: 'この組織では録画・録音を保存しません' }, { status: 403 })
  }
  const usable = assertUsable(s)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  try {
    const { signedUrl, token, path } = await createSignedUploadUrl(pathFor(s.id))
    return NextResponse.json({ signedUrl, token, path })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'URLの発行に失敗しました' }, { status: 502 })
  }
}

export async function PATCH(_req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (!s.consentedAt) return NextResponse.json({ error: '同意が必要です' }, { status: 403 })
  if (!s.organization.recordAudio) {
    return NextResponse.json({ error: 'この組織では録画・録音を保存しません' }, { status: 403 })
  }

  const path = pathFor(s.id)
  // クライアントの自己申告を信じず、実際に置かれたか確認してからDBに書く。
  // 存在しないパスを記録すると、削除cronが消せない幽霊レコードになる。
  if (!(await recordingExists(path))) {
    return NextResponse.json({ error: '録音が確認できませんでした' }, { status: 400 })
  }

  await prisma.mensetsuSession.update({ where: { id: s.id }, data: { recordingPath: path } })
  return NextResponse.json({ ok: true })
}
