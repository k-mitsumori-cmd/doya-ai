import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'

// ============================================
// 管理者APIの認証ガード
// ============================================
// ⚠️ `verifyAdminSession()` は**失敗時も `{ valid: false }` というオブジェクトを返す**。
//    戻り値そのものの真偽で判定すると、Cookie に何か値が入っているだけで素通りする
//    （2026-08-13 に /api/admin/feedback で実際に起きた認証バイパス）。
//    取り違えを繰り返さないよう、判定はこの関数に寄せる。
//
// ⚠️ `middleware.ts` は認証を見ていない。`/api/admin/**` の保護は
//    **各ルートが自分で行う**のが唯一の防御線。ハンドラを足したら必ずこれを呼ぶこと。
//    メソッドごとに呼ぶ必要がある（GET だけ守って POST が素通り、を防ぐ）。

/** 管理者として認証済みなら null、未認証なら 401 のレスポンスを返す */
export async function requireAdmin(): Promise<NextResponse | null> {
  const cookieStore = await cookies()
  const { valid } = await verifyAdminSession(cookieStore.get(COOKIE_NAME)?.value || null)
  if (!valid) {
    return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
  }
  return null
}
