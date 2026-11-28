export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleAppAuth } from '@/lib/auth-link/route-helpers.server'
import { confirmLink } from '@/lib/auth-link/app-auth-service'

/** POST: 結び付けの確認。コード（ログイン前）か、Bearer（前のログイン手段でログイン済み）のどちらか */
export async function POST(req: NextRequest) {
  return handleAppAuth(req, (deps, { body, authorization }) => confirmLink(deps, { authorization, body }))
}
