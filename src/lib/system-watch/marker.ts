// 自動点検（system-watch の B1）が作った物を、利用者の本物の物と見分けるための決まり。
// B1 はユーザー本人のアカウント（株式会社スリスタ）で商談の準備を通すため、見積の下書き・スライド・
// 商談準備の記録が本人の会社に1日1件ずつ増える。名前の先頭に必ず「【自動点検】」を付け、人が見て分かるようにする。
// ⚠️ 数えから外すのも、月1回の掃除で消すのも、名前ではなく記録の ID で行う（marked-records.ts）。
//    名前は利用者も自由に付けられるので、名前で消すと利用者の本物の記録まで消してしまう（消すのは統括の承認の後）。
//
// B1 は /api/agent/tasks を呼ぶとき、ヘッダ x-doya-system-watch に合図を付ける。
// ⚠️ 2026-10-26 統括の監査から、合図は watch-gate.ts の形（利用者と日本時間の日付を混ぜた値）にした。
//    作る側は systemWatchTokenFor(本人のユーザー ID)、確かめる側は isSystemWatchFor(headers, ログインしている本人)。
//    点検用の利用者（SYSTEM_WATCH_TEST_USER_ID）が本人で、今日の値のときだけ通る。
//    下の systemWatchToken / isSystemWatchRequest は前の形（決まった値）で、期限も利用者も確かめない。
//    枠から外す・名前に印を付けるの判定には使わない。
// 合図は CRON_SECRET から作る（外の人は作れない。CRON_SECRET そのものは送らない）。
import crypto from 'node:crypto'

export const SYSTEM_WATCH_PREFIX = '【自動点検】'
export const SYSTEM_WATCH_HEADER = 'x-doya-system-watch'

/** 前の形の合図の値。⚠️ 枠から外す判定には使わない（watch-gate.ts の systemWatchTokenFor を使う） */
export function systemWatchToken(secret: string | undefined = process.env.CRON_SECRET): string | null {
  if (!secret) return null
  return crypto.createHmac('sha256', secret).update('doya-system-watch:v1').digest('hex')
}

/** 前の形の合図か。⚠️ 期限と利用者を確かめないので、枠から外す判定には使わない（watch-gate.ts の isSystemWatchFor を使う） */
export function isSystemWatchRequest(headers: { get(name: string): string | null }, secret?: string): boolean {
  const expected = systemWatchToken(secret ?? process.env.CRON_SECRET)
  const got = headers.get(SYSTEM_WATCH_HEADER)
  if (!expected || !got || got.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))
}

/** 名前の先頭に印を付ける（二重には付けない。長さの上限を超えないよう、後ろを切る） */
export function withSystemWatchPrefix(name: string, maxLength = 120): string {
  const base = name.startsWith(SYSTEM_WATCH_PREFIX) ? name : SYSTEM_WATCH_PREFIX + name
  return base.slice(0, maxLength)
}

/** 名前に印が付いているか（人に見せる目印の確認だけに使う。⚠️ 数えから外す・消す判定には使わない。それは記録の ID で行う） */
export function isSystemWatchName(name: string | null | undefined): boolean {
  return !!name && name.startsWith(SYSTEM_WATCH_PREFIX)
}
