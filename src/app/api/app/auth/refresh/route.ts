export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleAppAuth } from '@/lib/auth-link/route-helpers.server'
import { refreshSession } from '@/lib/auth-link/app-auth-service'

/** POST: リフレッシュトークンで、新しいアクセストークンとリフレッシュトークンを出す（ローテーション） */
export async function POST(req: NextRequest) {
  return handleAppAuth(req, (deps, { body }) => refreshSession(deps, body))
}
