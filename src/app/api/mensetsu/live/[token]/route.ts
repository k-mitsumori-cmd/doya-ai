export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET /api/mensetsu/live/[token] — 応募者向け: 面接の公開情報
// ⚠️ 未認証で叩かれる。返却は toPublicSession() のホワイトリストのみ。
import { NextRequest, NextResponse } from 'next/server'
import { loadSessionByToken, toPublicSession } from '@/lib/mensetsu/public'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  return NextResponse.json({ session: toPublicSession(s) })
}
