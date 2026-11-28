export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handlePushToken } from '@/lib/auth-link/devices-handlers.server'

// Next 15 の route の型の決まり（params は Promise）に合わせる。Next のビルドの型の確認が、和の型を受け付けないため
type Ctx = { params: Promise<{ id: string }> }

/** POST: 端末の Expo のプッシュトークンを登録する（{ token: "ExponentPushToken[...]" }）。取り消しは { token: null }。Bearer だけ */
export async function POST(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  return handlePushToken(req, p.id)
}
