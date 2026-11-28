// ============================================
// ドヤパワーの「はじめの付与（最初の100）」の決まり（DB に触らない計算）
// ============================================
// 2026-10-26 ユーザー決定「最初100から進めるような形で全て作って」。
// - 会社を持った人に、最初の1回だけ 100 を付ける。台帳の種類は starter（期限なし・回復の上限で削られない。2026-10-26 統括の点検 中-1）。
//   毎日の回復の計算では starter の残りも数えるので、100 から始まり、使った分を毎日10ずつ回復する形になる（フリー）。
// - 付けるのは、Google のログインか、メールの確認が済んだ人だけ。
// - 同じ人には二度付けない。ユーザー単位でも、メール単位でも1回（会社の作り直し・退会して作り直しでも付けない）。
// - メールはそのまま残さず、小文字にそろえた形の SHA-256 だけを記録する（doya_power_starter_claims）。
import { createHash } from 'node:crypto'
import { gmailCanonicalKey, isApplePrivateRelay, isGmailAddress, normalizeEmail } from '../auth-link/email-normalize'

// 量とようこその知らせの文は、画面からも読めるよう starter-welcome.ts（node: を使わない）に置き、ここから出し直す
export { STARTER_POWER, STARTER_WELCOME } from './starter-welcome'

/** 台帳の sourceKey（会社ごとに1回。ユーザー・メールの1回は doya_power_starter_claims で守る） */
export const STARTER_SOURCE_KEY = 'starter'

/** 記録に使うメールの要約（小文字にそろえ、前後の空白を除いたものの SHA-256。16進64文字） */
export function starterEmailHash(email: string): string {
  return createHash('sha256').update(`doya-starter:v1:${email.trim().toLowerCase()}`).digest('hex')
}

/**
 * Gmail のドット違い・「+」付きを同じ人にそろえた要約（2026-11-25 三森さんの決定）。
 * 使うのは、受け取り済みかどうかの判定だけ。一意の制約や自動の結び付けには使わない。
 * Gmail 系（gmail.com / googlemail.com）以外は、小文字にそろえた形のまま。
 */
export function starterCanonicalEmailHash(email: string): string {
  const n = normalizeEmail(email)
  const key = n && isGmailAddress(n) ? gmailCanonicalKey(n) : null
  return createHash('sha256').update(`doya-starter:v2:${key ?? email.trim().toLowerCase()}`).digest('hex')
}

/** 受け取り済みの照会に使う要約の一覧（旧形式と、Gmail をそろえた形。重複は除く） */
export function starterEmailHashesForLookup(email: string): string[] {
  return Array.from(new Set([starterEmailHash(email), starterCanonicalEmailHash(email)]))
}

export type StarterDecision =
  | { ok: true }
  | { ok: false; reason: 'flag_off' | 'no_company' | 'not_owner' | 'not_verified' | 'no_email' | 'private_relay' | 'already_claimed' }

/** はじめの付与を付けてよいか */
export function decideStarter(input: {
  ledgerAllowed: boolean
  tablesAllowed: boolean
  hasCompany: boolean
  isOwner: boolean
  email: string | null | undefined
  /** Google のログインがあるか、メールの確認が済んでいるか */
  verified: boolean
  /** このユーザーか、このメールか、同じ人の別の User（正規化メールが同じ行）で、もう受け取っているか */
  claimed: boolean
}): StarterDecision {
  if (!input.ledgerAllowed || !input.tablesAllowed) return { ok: false, reason: 'flag_off' }
  if (!input.hasCompany) return { ok: false, reason: 'no_company' }
  if (!input.isOwner) return { ok: false, reason: 'not_owner' }
  if (!input.email || !input.email.includes('@')) return { ok: false, reason: 'no_email' }
  // Apple の「メールを隠す」のメールは、過去の受け取り（本当のメールの要約）と突き合わせられない。迷うときは付けない（fail-closed）
  if (isApplePrivateRelay(input.email)) return { ok: false, reason: 'private_relay' }
  if (!input.verified) return { ok: false, reason: 'not_verified' }
  if (input.claimed) return { ok: false, reason: 'already_claimed' }
  return { ok: true }
}

