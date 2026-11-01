// ============================================
// 「見た」知らせの記録（ユーザーごと・この端末）
// ============================================
// once の知らせを閉じたら、id をここに残し、二度と出さない。
// ⚠️ 段階1は端末（localStorage）に、ユーザーごとのキーで残す。DB には書かない。
//    別の端末でも出さないようにするのは段階2（SystemSetting に notice_seen:user:<id> で持つ案）。
// ⚠️ localStorage が使えない（プライベート・ブロック）ときは、この画面の中だけ覚える。

const PREFIX = 'doya-notice-seen:v1:'
/** 残す数の上限（古いものから捨てる） */
export const SEEN_MAX = 300

export function seenKey(userKey: string): string {
  return PREFIX + (userKey || 'anon')
}

/** 保存した文字列を読む。形が違えば空 */
export function parseSeen(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-SEEN_MAX) : []
  } catch {
    return []
  }
}

/** 1つ足して、保存する文字列にする */
export function addSeen(list: string[], id: string): string[] {
  return [...list.filter((x) => x !== id), id].slice(-SEEN_MAX)
}

export function loadSeen(userKey: string): string[] {
  try {
    return parseSeen(window.localStorage.getItem(seenKey(userKey)))
  } catch {
    return []
  }
}

export function saveSeen(userKey: string, list: string[]): void {
  try {
    window.localStorage.setItem(seenKey(userKey), JSON.stringify(list))
  } catch {
    // 保存できなくても、この画面の中では覚えている
  }
}

// ---- 知らせの量（提案リスト (34)）。見た記録と同じく、ユーザーごとに端末へ残す ----
const LEVEL_PREFIX = 'doya-notice-level:v1:'
export function loadLevelRaw(userKey: string): string | null {
  try { return window.localStorage.getItem(LEVEL_PREFIX + (userKey || 'anon')) } catch { return null }
}
export function saveLevelRaw(userKey: string, level: string): void {
  try { window.localStorage.setItem(LEVEL_PREFIX + (userKey || 'anon'), level) } catch { /* 保存できなくても、この画面の中では効く */ }
}

// ---- 1日1つまでに間引く知らせ（paced）を、最後に出した日（日本時間の年月日）。ユーザーごとに端末へ残す ----
const PACED_PREFIX = 'doya-notice-paced:v1:'
export function loadPacedDay(userKey: string): string {
  try { return window.localStorage.getItem(PACED_PREFIX + (userKey || 'anon')) ?? '' } catch { return '' }
}
export function savePacedDay(userKey: string, day: string): void {
  try { window.localStorage.setItem(PACED_PREFIX + (userKey || 'anon'), day) } catch { /* 保存できなくても、この画面の中では効く */ }
}
