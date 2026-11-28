export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleReviewLogin } from '@/lib/auth-link/web-handoff-handlers.server'

/**
 * POST: Apple の審査員のための限定ログイン。旗 APP_REVIEW_LOGIN_ENABLED・審査用のメールとコードがそろわなければ、理由を出さずに 404。
 * 契約: docs/architecture/2026-11-18-app/store-prep/03-demo-account.md
 */
export async function POST(req: NextRequest) {
  return handleReviewLogin(req)
}
