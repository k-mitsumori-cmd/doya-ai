export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { appAuthOffResponse } from '@/lib/auth-link/app-auth-flag'
import { deleteAccount } from '@/lib/auth-link/account-delete'
import { createPrismaDeleteRepo } from '@/lib/auth-link/account-delete.server'

/**
 * POST: 退会（匿名化）。Cookie か Bearer のセッション（Bearer は middleware が Cookie に置き換える）。
 * 本文: { confirm: 'DELETE' }。旗 APP_AUTH_ENABLED がオンのときだけ動く（オフは 404）。
 * 契約: docs/architecture/2026-11-18-app/api-contract.md
 */
export async function POST(req: NextRequest) {
  const off = appAuthOffResponse()
  if (off) return off
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return NextResponse.json({ code: 'INVALID_TOKEN' }, { status: 401 })
    let body: { confirm?: unknown } | null = null
    try { body = await req.json() } catch { body = null }
    const r = await deleteAccount(createPrismaDeleteRepo(prisma), { userId, confirm: body?.confirm, now: new Date() })
    return NextResponse.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ code: 'INTERNAL' }, { status: 500 })
  }
}
