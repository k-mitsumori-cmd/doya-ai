// ============================================
// 最近作った物の記録（提案リスト (7) 成果物の受け渡し。NOTICE-PARTS §6.2）
// ============================================
// 次のツールで「さっき作った見積書を材料にしますか」と出すために、種類・id・時刻だけを、ユーザーごとに端末へ残す。
// ⚠️ 中身も表示名も残さない（表示名には顧客名が入りえるため。統括の点検 8、セキュリティの点検 2026-10-26）。
//    中身は、本人が「材料にする」を押したときに、次のツールのサーバーが本人の組織の範囲で読み直す。
// ⚠️ ログアウトのときも消す（clearAllRecentArtifacts）。残るのは種類・id・時刻だけなので、消し漏れがあっても顧客の情報は残らない。
// ⚠️ 直近の3件だけ。1日より古いものは使わない。

export type ArtifactKind = 'quote'
export const ARTIFACT_KINDS: readonly ArtifactKind[] = ['quote']
/** サーバーの受け取り（/api/doyaslide/projects/from-quote）と同じ id の形 */
export const ARTIFACT_ID_PATTERN = /^[a-z0-9]{20,40}$/i
export const ARTIFACT_MAX = 3
export const ARTIFACT_FRESH_MS = 24 * 60 * 60 * 1000

export interface RecentArtifact { kind: ArtifactKind; id: string; at: number }

const PREFIX = 'doya-recent-artifacts:v1:'
export function artifactsKey(userKey: string): string { return PREFIX + (userKey || 'anon') }

/** 保存した文字列を読む。形が違うものは捨てる */
export function parseArtifacts(raw: string | null | undefined): RecentArtifact[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    return v.filter((a): a is RecentArtifact =>
      a && typeof a === 'object' && ARTIFACT_KINDS.includes(a.kind) && typeof a.id === 'string' && ARTIFACT_ID_PATTERN.test(a.id)
      && typeof a.at === 'number').map((a) => ({ kind: a.kind, id: a.id, at: a.at })).slice(0, ARTIFACT_MAX)
  } catch {
    return []
  }
}

/** 1つ足す（同じものは先頭に移す。種類・id・時刻のほかは残さない） */
export function addArtifact(list: RecentArtifact[], a: RecentArtifact): RecentArtifact[] {
  if (!ARTIFACT_KINDS.includes(a.kind) || !ARTIFACT_ID_PATTERN.test(a.id)) return list
  const item: RecentArtifact = { kind: a.kind, id: a.id, at: a.at }
  return [item, ...list.filter((x) => !(x.kind === a.kind && x.id === a.id))].slice(0, ARTIFACT_MAX)
}

/** 材料に使える、いちばん新しいもの（1日以内） */
export function freshestArtifact(list: RecentArtifact[], kind: ArtifactKind, now: number): RecentArtifact | null {
  return list.find((a) => a.kind === kind && now - a.at < ARTIFACT_FRESH_MS) ?? null
}

/** 作ったプロジェクトの画面へ移るときの行き先。サーバーが返した id から作り、形を確かめる（統括の点検 5） */
export function slideProjectPath(projectId: unknown): string | null {
  return typeof projectId === 'string' && ARTIFACT_ID_PATTERN.test(projectId) ? `/doyaslide/${projectId}?generate=1` : null
}

export function loadArtifacts(userKey: string): RecentArtifact[] {
  try { return parseArtifacts(window.localStorage.getItem(artifactsKey(userKey))) } catch { return [] }
}
export function saveArtifacts(userKey: string, list: RecentArtifact[]): void {
  try { window.localStorage.setItem(artifactsKey(userKey), JSON.stringify(list)) } catch { /* 残せなくても画面は動く */ }
}
/** ログアウトのとき、すべてのユーザーの記録を消す */
export function clearAllRecentArtifacts(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) { const k = window.localStorage.key(i); if (k?.startsWith(PREFIX)) keys.push(k) }
    for (const k of keys) window.localStorage.removeItem(k)
  } catch { /* 消せなくてもログアウトは続ける */ }
}

/** ログインしている人のほかの記録（同じ端末で前に使った人の分）を消す */
export function clearOtherUsersArtifacts(userKey: string): void {
  try {
    const keep = artifactsKey(userKey)
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) { const k = window.localStorage.key(i); if (k?.startsWith(PREFIX) && k !== keep) keys.push(k) }
    for (const k of keys) window.localStorage.removeItem(k)
  } catch { /* 消せなくても画面は動く */ }
}
