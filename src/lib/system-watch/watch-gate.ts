// 自動点検（system-watch の B1）の合図を、ツールのルートが受け入れてよいかを決める部品（2026-10-26 統括の監査で追加）。
//
// ⚠️ marker.ts の isSystemWatchRequest は、決まった値（CRON_SECRET の HMAC）を比べるだけだった。
//    値は期限も使い回しの防ぎも無く、利用者も選ばない。漏れれば、誰のアカウントでも枠と利用の制限を抜けられた。
//    そこで、枠から外すルート（見積書・スライド・スライドの構成・商談準備）は、この部品だけで確かめる。
// 受け入れる条件（どれか1つでも欠けたら、ふつうの利用として数える。fail-closed）:
//   1. SYSTEM_WATCH_TEST_USER_ID が設定されていて、ログインしている本人がその利用者であること
//   2. 合図が、その利用者と今日（日本時間）の日付から作った値であること（前の日の値・ほかの人の値は通らない）
//   3. 組織を使うツール（見積書・商談準備）は、組織の契約者が本人であること（ルートの側で確かめる）
// 送る側（B1）は systemWatchTokenFor(本人のユーザー ID) をヘッダ x-doya-system-watch に付ける。
import crypto from 'node:crypto'
import { SYSTEM_WATCH_HEADER } from '@/lib/system-watch/marker'

type Env = Record<string, string | undefined>

/** 日本時間の YYYY-MM-DD */
export function jstDate(at: Date = new Date()): string {
  return new Date(at.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** 自動点検に使う利用者の ID。設定が無ければ null（何も外さない） */
export function systemWatchUserId(env: Env = process.env): string | null {
  const id = env.SYSTEM_WATCH_TEST_USER_ID?.trim()
  return id ? id : null
}

/** 合図の値。その利用者と、その日（日本時間）だけに通る。CRON_SECRET が無ければ null */
export function systemWatchTokenFor(userId: string, at: Date = new Date(), secret: string | undefined = process.env.CRON_SECRET): string | null {
  if (!secret || !userId) return null
  return crypto.createHmac('sha256', secret).update(`doya-system-watch:v2:${jstDate(at)}:${userId}`).digest('hex')
}

/**
 * このリクエストを自動点検として扱ってよいか。userId はログインしている本人（ルートがセッションから決めたもの）。
 * 例外は投げない（読めないときは false）。
 */
export function isSystemWatchFor(
  headers: { get(name: string): string | null } | undefined | null,
  userId: string | null | undefined,
  at: Date = new Date(),
  env: Env = process.env,
): boolean {
  try {
    const testUser = systemWatchUserId(env)
    if (!testUser || !userId || userId !== testUser) return false
    // 渡された env だけを見る（env に秘密が無いときに、引数の既定値で本物の環境変数を読まないように '' を渡す）
    const expected = systemWatchTokenFor(userId, at, env.CRON_SECRET ?? '')
    const got = headers?.get?.(SYSTEM_WATCH_HEADER) ?? null
    if (!expected || !got || got.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))
  } catch {
    return false
  }
}
