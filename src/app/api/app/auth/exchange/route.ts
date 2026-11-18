export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleAppAuth } from '@/lib/auth-link/route-helpers.server'
import { exchangeIdToken } from '@/lib/auth-link/app-auth-service'

/** POST: Apple・Google の id_token をアプリ用のトークンに交換する。契約: docs/architecture/2026-11-18-app/api-contract.md */
export async function POST(req: NextRequest) {
  return handleAppAuth(req, (deps, { body }) => exchangeIdToken(deps, body))
}
