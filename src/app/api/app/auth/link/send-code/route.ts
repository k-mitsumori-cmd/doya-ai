export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleAppAuth } from '@/lib/auth-link/route-helpers.server'
import { sendLinkCode } from '@/lib/auth-link/app-auth-service'

/** POST: 結び付けの確認コードを、つなぐ先のユーザーのメールへ送る（1つの待ちにつき1回） */
export async function POST(req: NextRequest) {
  return handleAppAuth(req, (deps, { body }) => sendLinkCode(deps, body))
}
