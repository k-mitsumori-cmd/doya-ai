export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleWebHandoffConsume } from '@/lib/auth-link/web-handoff-handlers.server'

/** GET: コードを1回だけ使い、Web のセッション Cookie をセットして next へ 302（WebView が開く）。契約: docs/architecture/2026-11-18-app/api-contract.md */
export async function GET(req: NextRequest) {
  return handleWebHandoffConsume(req)
}
