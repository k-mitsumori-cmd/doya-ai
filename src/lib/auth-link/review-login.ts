import { isAppAuthEnabled } from './app-auth-flag'
import { normalizeEmail } from './email-normalize'

/**
 * 審査用の限定ログイン（POST /api/app/auth/review-login）の設定。2026-11-25 三森さんの決定（案 A）。
 * 設計と安全の条件: docs/architecture/2026-11-18-app/store-prep/03-demo-account.md の4章。
 *
 * 動くのは、次の3つがそろったときだけ。1つでも欠ければ、呼び出し側は、理由を出さずに 404 にする。
 *   (a) 旗 APP_AUTH_ENABLED がオン
 *   (b) 旗 APP_REVIEW_LOGIN_ENABLED が '1'（審査を出す直前にオンにし、承認されたらすぐオフにする）
 *   (c) 審査用のメール APP_REVIEW_LOGIN_EMAIL と、コード APP_REVIEW_LOGIN_CODE（8文字以上）が入っている
 * 値は環境変数だけに置く。コード・文書・ログには書かない。
 */
export const REVIEW_CODE_MIN_LENGTH = 8
/** 管理画面に入れるドメイン。審査用のアカウントは、このドメインにしない */
export const REVIEW_FORBIDDEN_DOMAIN = 'surisuta.jp'

export type ReviewLoginConfig = { email: string; code: string }

export function readReviewLoginConfig(env: Record<string, string | undefined>): ReviewLoginConfig | null {
  if (!isAppAuthEnabled(env)) return null
  if (env.APP_REVIEW_LOGIN_ENABLED !== '1') return null
  const email = normalizeEmail(env.APP_REVIEW_LOGIN_EMAIL)
  const code = env.APP_REVIEW_LOGIN_CODE
  if (!email || !code || code.length < REVIEW_CODE_MIN_LENGTH) return null
  if (isForbiddenReviewEmail(email)) return null
  return { email, code }
}

/** 管理画面の Google の条件に当たるドメイン（サブドメインを含む）は、審査用に使えない */
export function isForbiddenReviewEmail(normalizedEmail: string): boolean {
  const domain = normalizedEmail.slice(normalizedEmail.indexOf('@') + 1)
  return domain === REVIEW_FORBIDDEN_DOMAIN || domain.endsWith(`.${REVIEW_FORBIDDEN_DOMAIN}`)
}
