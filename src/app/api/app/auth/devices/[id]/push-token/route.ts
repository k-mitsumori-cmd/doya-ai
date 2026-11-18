export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handlePushToken } from '@/lib/auth-link/devices-handlers.server'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

/** POST: 端末の Expo のプッシュトークンを登録する（{ token: "ExponentPushToken[...]" }）。取り消しは { token: null }。Bearer だけ */
export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return handlePushToken(req, p.id)
}
