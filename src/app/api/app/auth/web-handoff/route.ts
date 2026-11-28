export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleWebHandoffCreate } from '@/lib/auth-link/web-handoff-handlers.server'

/** POST: アプリのセッション（Bearer + x-doya-app: 1）から、Web へ引き渡す使い捨てのコード入りの URL を作る。契約: docs/architecture/2026-11-18-app/api-contract.md */
export async function POST(req: NextRequest) {
  return handleWebHandoffCreate(req)
}
