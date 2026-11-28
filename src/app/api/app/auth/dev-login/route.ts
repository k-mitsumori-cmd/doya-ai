export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleDevLogin } from '@/lib/auth-link/web-handoff-handlers.server'

/**
 * POST: 手元の開発だけで使う、開発用ログイン。旗・APP_DEV_LOGIN・NODE_ENV・VERCEL・Host の5条件がそろわなければ、理由を出さずに 404。
 * 契約: docs/architecture/2026-11-18-app/api-contract.md の「dev-login」
 */
export async function POST(req: NextRequest) {
  return handleDevLogin(req)
}
