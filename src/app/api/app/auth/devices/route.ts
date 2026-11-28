export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { handleDevicesList } from '@/lib/auth-link/devices-handlers.server'

/** GET: ログイン中の端末の一覧（Bearer か Web の Cookie のセッション。旗がオフなら 404） */
export async function GET(req: NextRequest) {
  return handleDevicesList(req)
}
