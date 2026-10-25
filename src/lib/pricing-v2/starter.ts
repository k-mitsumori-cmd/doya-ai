// ============================================
// ドヤパワーの「はじめの付与（最初の100）」の決まり（DB に触らない計算）
// ============================================
// 2026-10-26 ユーザー決定「最初100から進めるような形で全て作って」。
// - 会社を持った人に、最初の1回だけ 100 を付ける。台帳の種類は毎日の回復（daily_recovery。期限なし・回復の上限 100 の中）と同じ。
//   最初から上限まで入っているので、使った分を毎日10ずつ回復する形になる（フリー）。
// - 付けるのは、Google のログインか、メールの確認が済んだ人だけ。
// - 同じ人には二度付けない。ユーザー単位でも、メール単位でも1回（会社の作り直し・退会して作り直しでも付けない）。
// - メールはそのまま残さず、小文字にそろえた形の SHA-256 だけを記録する（doya_power_starter_claims）。
import { createHash } from 'node:crypto'

/** はじめの付与の量 */
export const STARTER_POWER = 100

/** 台帳の sourceKey（会社ごとに1回。ユーザー・メールの1回は doya_power_starter_claims で守る） */
export const STARTER_SOURCE_KEY = 'starter'

/** 記録に使うメールの要約（小文字にそろえ、前後の空白を除いたものの SHA-256。16進64文字） */
export function starterEmailHash(email: string): string {
  return createHash('sha256').update(`doya-starter:v1:${email.trim().toLowerCase()}`).digest('hex')
}

export type StarterDecision =
  | { ok: true }
  | { ok: false; reason: 'flag_off' | 'no_company' | 'not_owner' | 'not_verified' | 'no_email' | 'already_claimed' }

/** はじめの付与を付けてよいか */
export function decideStarter(input: {
  ledgerAllowed: boolean
  tablesAllowed: boolean
  hasCompany: boolean
  isOwner: boolean
  email: string | null | undefined
  /** Google のログインがあるか、メールの確認が済んでいるか */
  verified: boolean
  /** このユーザーか、このメールで、もう受け取っているか */
  claimed: boolean
}): StarterDecision {
  if (!input.ledgerAllowed || !input.tablesAllowed) return { ok: false, reason: 'flag_off' }
  if (!input.hasCompany) return { ok: false, reason: 'no_company' }
  if (!input.isOwner) return { ok: false, reason: 'not_owner' }
  if (!input.email || !input.email.includes('@')) return { ok: false, reason: 'no_email' }
  if (!input.verified) return { ok: false, reason: 'not_verified' }
  if (input.claimed) return { ok: false, reason: 'already_claimed' }
  return { ok: true }
}

/**
 * 最初のログインの「ようこそ」の知らせの文（見た目と出し方は UI リニューアルの知らせの部品）。
 * 出す条件: /api/pricing/upsell の starter が null でなく、その知らせをまだ見ていない（利用者の端末で1回）。
 */
export const STARTER_WELCOME = {
  title: 'ドヤパワー 100 からスタートです',
  body: 'AIで作るときに使うポイントです。使った分は、毎日10ずつ回復します（たまる上限は100）。',
  action: { label: 'ドヤパワーを見る', href: '/home/doya-power' },
} as const
