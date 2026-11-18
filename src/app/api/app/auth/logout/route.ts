export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleAppAuth } from '@/lib/auth-link/route-helpers.server'
import { logout } from '@/lib/auth-link/app-auth-service'

/** POST: Bearer のセッションと、その端末の系統を失効させる */
export async function POST(req: NextRequest) {
  return handleAppAuth(req, (deps, { authorization }) => logout(deps, authorization), { readBody: false })
}
