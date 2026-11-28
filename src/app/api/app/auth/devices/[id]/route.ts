export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleDeviceRevoke } from '@/lib/auth-link/devices-handlers.server'

// Next 15 の route の型の決まり（params は Promise）に合わせる。Next のビルドの型の確認が、和の型を受け付けないため
type Ctx = { params: Promise<{ id: string }> }

/** DELETE: 自分の端末を失効させる（対の Session と、その端末から引き渡した Web のセッションも消す） */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  return handleDeviceRevoke(req, p.id)
}
