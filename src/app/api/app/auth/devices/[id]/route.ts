export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleDeviceRevoke } from '@/lib/auth-link/devices-handlers.server'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

/** DELETE: 自分の端末を失効させる（対の Session と、その端末から引き渡した Web のセッションも消す） */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return handleDeviceRevoke(req, p.id)
}
