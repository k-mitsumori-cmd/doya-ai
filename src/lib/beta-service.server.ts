// ============================================
// 開発中のベータ版のツールの入口の判定（サーバー専用）
// ============================================
// 画面（layout）と API の先頭で呼ぶ。判定の中身は src/lib/beta-service.ts。
// ⚠️ cron などサーバーの内部の処理（データの整理など）では呼ばない。ログインした人の操作だけを止める。
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isBetaHiddenService } from '@/lib/services'
import { BETA_HIDDEN_MESSAGE, canUseBetaService } from '@/lib/beta-service'

/** ログイン中の人が、このツールを使ってよいか。セッションが読めないときは使えない側にする */
export async function canAccessBetaService(serviceId: string): Promise<boolean> {
  if (!isBetaHiddenService(serviceId)) return true
  try {
    const session = await getServerSession(authOptions)
    return canUseBetaService(serviceId, session?.user?.email)
  } catch {
    return false
  }
}

/** API の先頭で呼ぶ。使えない人には 403 を返す。使える人には null */
export async function betaServiceDenied(serviceId: string): Promise<NextResponse | null> {
  if (await canAccessBetaService(serviceId)) return null
  return NextResponse.json(
    { error: BETA_HIDDEN_MESSAGE, code: 'BETA_HIDDEN' },
    { status: 403, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } },
  )
}
