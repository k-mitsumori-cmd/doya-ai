import { isApplePrivateRelay, normalizeEmail } from './email-normalize'

/**
 * 結び付けの決定表（純粋関数。DB・ネットワークに触らない）。
 * 設計の根拠: docs/architecture/2026-11-18-app/account-integrity.md の 4.1・4.2。
 *
 * Web（NextAuth の signIn コールバック）とアプリ（トークン交換の API）は、同じこの関数を通る。
 * 呼び出し側が DB を引いて入力を作り、返った決定に従って DB を書く。この関数自身は何も書かない。
 */

export const SUPPORTED_PROVIDERS = ['google', 'apple'] as const
export type LinkProvider = (typeof SUPPORTED_PROVIDERS)[number]

export type LinkInput = {
  /** いまログインしてきた手段 */
  identity: {
    provider: string
    /** 提供元が返す、そのユーザーの不変の ID（OIDC の sub） */
    providerAccountId: string
    /** 提供元が返したメール（無ければ null。Apple は2回めから返さない） */
    email: string | null
    /** 提供元が「確認済み」と返したか（Apple の文字列 'true' は、呼び出し側または id-token.ts で真偽値にしておく） */
    emailVerified: boolean | null
  }
  /** 同じ (provider, providerAccountId) の Account の持ち主。無ければ null */
  existingAccount: { userId: string } | null
  /** 正規化したメールで見つかった既存ユーザー。無ければ null。呼び出し側は normalizeEmail(identity.email) で引く */
  userByEmail: { userId: string } | null
  /** すでにログイン中のユーザー（設定画面からログイン手段を足す場合）。無ければ null */
  currentUserId: string | null
}

export type RejectReason =
  | 'invalid-input'
  | 'unsupported-provider'
  | 'identity-belongs-to-other-user'

/** 新しいユーザーを作るとき、User.email に何を入れてよいか。 */
export type EmailPolicy =
  /** 確認済みで、隠していないメール。User.email と emailNormalized に入れてよい */
  | 'store'
  /** Apple の「メールを隠す」。連絡用に User.email に入れてよいが、照合・招待には使わない */
  | 'contact-only'
  /** 未確認、またはメールが無い。User.email には入れない（Account 側の控えに残すだけ） */
  | 'omit'

export type LinkDecision =
  | { action: 'login-existing'; userId: string }
  | { action: 'create-user'; emailPolicy: EmailPolicy }
  | {
      action: 'require-confirmation'
      /** つなぐ先の既存ユーザー */
      targetUserId: string
      /** 本人が選べる確認の方法 */
      methods: ReadonlyArray<'previous-login' | 'email-code'>
    }
  | { action: 'link-to-current'; userId: string }
  | { action: 'reject'; reason: RejectReason }

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/**
 * 上から順に判定する。最初に当てはまったものを返す。
 *
 * 1. 入力が不正（提供元・sub が空）、または対応していない提供元 -> reject。
 *    対応するのは google と apple だけ。ほかの提供元が増えるときは、ここを意識して直す。
 * 2. 同じ (provider, providerAccountId) の Account がある -> login-existing。メールは見ない。
 *    ただし、すでにログイン中のユーザーがいて、その Account がほかのユーザーのものなら reject。
 *    理由: 別のユーザーに付いたログイン手段を、黙って今のユーザーへ移すと、他人のデータに入れてしまうため。
 *    この場合は統合の手順（管理者の作業）へ案内する。
 * 3. ログイン中のユーザーがいる -> link-to-current。メールは見ない。
 *    理由: 本人がすでにログインしており、設定画面で自分のログイン手段を足す操作だから。
 * 4. ログインしていない。メールで既存ユーザーを探してよいのは、次の両方を満たすときだけ。
 *    - 提供元が「確認済み」と返している（emailVerified が true）。
 *    - Apple の「メールを隠す」ではない。
 *    満たさないとき（未確認、メール無し、隠したメール）はメールでは照合せず、create-user を返す。
 *    emailPolicy は、隠したメールで確認済みなら 'contact-only'、それ以外（未確認・メール無し）は 'omit'。
 *    理由: 未確認のメールで照合すると、他人のメールを名乗って既存ユーザーに入れてしまう（乗っ取り）。
 *    隠したメールは、本人のメールとは一致しない。Apple の初回以外はメールが来ないことにも備える。
 * 5. 照合してよいメールで、同じメールの既存ユーザーがいる -> require-confirmation。
 *    自動では結び付けず、新しいユーザーも作らない。前に使ったログイン手段で一度ログインするか、
 *    既存ユーザーのメールあてに送る確認コードで本人を確かめてもらう。
 *    理由: メールが同じだけでは同じ人とは限らない。自動で結び付けると、メールを確認していない経路や
 *    提供元の誤りから、他人のアカウントに入れてしまう。NextAuth の allowDangerousEmailAccountLinking は使わない。
 *    （両方が確認済みのときだけ自動で結び付ける案 = 決定の質問4の B は、三森さんが A を選んだので持たない。）
 * 6. 照合してよいメールで、既存ユーザーがいない -> create-user（emailPolicy は 'store'）。
 *
 * userByEmail は、呼び出し側が「照合してよいメール」だけで引いたもの、という前提で渡される。
 * ただし防御として、照合してはいけない入力のときは、渡されていても無視する（4 の条件を、この関数でも守る）。
 */
export function decideLink(input: LinkInput): LinkDecision {
  if (!input) return { action: 'reject', reason: 'invalid-input' }
  const { identity, existingAccount, userByEmail, currentUserId } = input

  if (!identity || !nonEmpty(identity.provider) || !nonEmpty(identity.providerAccountId)) {
    return { action: 'reject', reason: 'invalid-input' }
  }
  if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(identity.provider)) {
    return { action: 'reject', reason: 'unsupported-provider' }
  }
  const current = nonEmpty(currentUserId) ? currentUserId : null

  // 2
  if (existingAccount) {
    if (!nonEmpty(existingAccount.userId)) return { action: 'reject', reason: 'invalid-input' }
    if (current && existingAccount.userId !== current) {
      return { action: 'reject', reason: 'identity-belongs-to-other-user' }
    }
    return { action: 'login-existing', userId: existingAccount.userId }
  }

  // 3
  if (current) return { action: 'link-to-current', userId: current }

  // 4
  const normalized = normalizeEmail(identity.email)
  const relay = isApplePrivateRelay(identity.email)
  const verified = identity.emailVerified === true
  const matchable = Boolean(normalized) && verified && !relay
  if (!matchable) {
    // 隠したメールは、確認済みと返されたときだけ連絡用に使う。未確認・無しは入れない。
    const emailPolicy: EmailPolicy = relay && verified ? 'contact-only' : 'omit'
    return { action: 'create-user', emailPolicy }
  }

  // 5・6
  if (userByEmail && nonEmpty(userByEmail.userId)) {
    return { action: 'require-confirmation', targetUserId: userByEmail.userId, methods: ['previous-login', 'email-code'] }
  }
  return { action: 'create-user', emailPolicy: 'store' }
}
