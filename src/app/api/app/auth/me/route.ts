export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleAppAuth } from '@/lib/auth-link/route-helpers.server'
import { me } from '@/lib/auth-link/app-auth-service'

/** GET: ログイン中のユーザーの最小の情報 */
export async function GET(req: NextRequest) {
  return handleAppAuth(req, (deps, { authorization }) => me(deps, authorization), { readBody: false })
}
