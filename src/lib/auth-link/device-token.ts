import { createHash } from 'node:crypto'

/**
 * アプリ用トークンの規則（純粋関数。時刻と乱数は引数で渡す。DB・ネットワークに触らない）。
 * 設計の根拠: docs/architecture/2026-11-18-app/account-integrity.md の 5章、spike-middleware-bearer.md の 3.3。
 *
 * 2種類のトークンを出す。
 *  - アクセストークン: NextAuth の Session の行の sessionToken。初期の期限は1時間。
 *    ⚠ NextAuth は、DB のセッションを最初に使ったときに期限を「いま + 24時間」へ延ばす（spike の 3.3）。
 *    このため、「1時間で切れる」を前提にしない。アプリは 401 でリフレッシュに回る作りにする。
 *    失効は Session の行を消すことで行う（期限と無関係に効く）。
 *  - リフレッシュトークン: 端末ごとの乱数。有効期間は90日。使うたびに新しいものに替える（ローテーション）。
 *    DB（AppDevice）に持つのは SHA-256 のハッシュだけ。平文は端末の Keychain にだけある。
 *
 * AppDevice の1行は、リフレッシュトークン1つに対応する。同じ端末のログインから続く行を familyId でまとめる（系統）。
 * 古いトークンを使い回す者がいたら、その系統を全部失効させる。
 */

export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000
const TOKEN_BYTES = 32

/** 乱数の供給元。本番は crypto.randomBytes を渡す。試験は固定の列を渡す。 */
export type RandomBytes = (size: number) => Uint8Array

/** AppDevice の行のうち、規則に必要な列。 */
export type DeviceRow = {
  id: string
  userId: string
  familyId: string
  refreshTokenHash: string
  rotatedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** URL 安全な base64（パディング無し）。 */
function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function generateOpaqueToken(randomBytes: RandomBytes): string {
  const bytes = randomBytes(TOKEN_BYTES)
  if (!bytes || bytes.length !== TOKEN_BYTES) throw new Error('randomBytes must return 32 bytes')
  return toBase64Url(bytes)
}

/**
 * Cookie のヘッダーに入れてよいトークンの形か。
 * middleware で Bearer の値を Cookie に置き換えるとき、この形でなければ 401 にする。
 * 「;」「,」「空白」「=」を含む値を通すと、別の Cookie を紛れ込ませられる（spike の 4章の5）。
 * 範囲は、このファイルが作る値（43文字）と、NextAuth が作る UUID を含む 16〜256 文字の英数字・「-」「_」。
 */
export function isSafeTokenValue(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,256}$/.test(value)
}

export type IssuedSession = {
  /** アプリへ返す。Session.sessionToken に入れる */
  accessToken: string
  accessExpiresAt: Date
  /** アプリへ返す。端末の Keychain に置く。DB には入れない */
  refreshToken: string
  /** DB（AppDevice）に入れる行 */
  device: {
    familyId: string
    refreshTokenHash: string
    expiresAt: Date
    rotatedAt: null
    revokedAt: null
  }
}

/**
 * ログインの直後に、アクセストークンと、新しい系統のリフレッシュトークンを出す。
 * 呼び出し側は、Session の行（sessionToken = accessToken、expires = accessExpiresAt）と
 * AppDevice の行（device の中身 + userId・deviceLabel・platform）を1つの処理で作る。
 */
export function issueSession(args: { now: Date; randomBytes: RandomBytes }): IssuedSession {
  const { now, randomBytes } = args
  const accessToken = generateOpaqueToken(randomBytes)
  const refreshToken = generateOpaqueToken(randomBytes)
  const familyId = generateOpaqueToken(randomBytes)
  return {
    accessToken,
    accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
    refreshToken,
    device: {
      familyId,
      refreshTokenHash: sha256Hex(refreshToken),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
      rotatedAt: null,
      revokedAt: null,
    },
  }
}

export type RefreshDecision =
  /** 更新してよい。old の行に rotatedAt = now を入れ、next の行（同じ familyId）を作り、新しい Session を作る */
  | { action: 'rotate'; familyId: string; rotatedAt: Date }
  /** 知らないトークン。401。 */
  | { action: 'reject'; reason: 'unknown' | 'malformed' | 'expired' | 'revoked' | 'retry-conflict' }
  /** ローテーション済みのトークンの再利用。系統を全部失効させ、401 を返す。 */
  | { action: 'revoke-family'; familyId: string; userId: string; revokedAt: Date }

export type DecideRefreshOptions = {
  /**
   * ローテーション直後の再送（応答が届かず、アプリが同じトークンで再試行した場合）を許す猶予。単位はミリ秒。
   * 既定は0（猶予なし。再利用は即、系統を失効）。
   * 猶予の中の再利用は、系統を失効させず 'retry-conflict'（409 など）を返す。アプリは新しいトークンを使い直す。
   */
  reuseLeewayMs?: number
}

/**
 * リフレッシュトークンの検証と、次の動きの決定。row は、トークンの SHA-256 で一意に引いた AppDevice の行（無ければ null）。
 *
 * 順序:
 * 1. 形が不正（isSafeTokenValue でない）または行が無い -> reject（行を引く前に形を見る。呼び出し側は引く前にも使える）
 * 2. 行が失効済み -> reject 'revoked'
 * 3. 行がローテーション済み（rotatedAt がある）-> 使い回し。猶予の中なら reject 'retry-conflict'、
 *    外なら revoke-family（その系統の全部の行を失効させる）。失効済みや期限切れより先に見る。
 *    理由: 盗まれたトークンの再利用を、期限切れで見逃さないため。
 * 4. 期限切れ -> reject 'expired'
 * 5. それ以外 -> rotate。新しい期限は now + 90日（端末を使い続ける限り延びる）。
 *
 * 注意: 2 の「失効済み」は、系統の失効（revoke-family）で全行が revokedAt を持った後の再試行も含む。
 * その場合は 3 より前に 'revoked' として弾かれる（二重の失効をしない）。
 */
export function decideRefresh(args: {
  token: unknown
  row: DeviceRow | null
  now: Date
  options?: DecideRefreshOptions
}): RefreshDecision {
  const { token, row, now, options } = args
  if (!isSafeTokenValue(token)) return { action: 'reject', reason: 'malformed' }
  if (!row) return { action: 'reject', reason: 'unknown' }
  // 呼び出し側の取り違えを防ぐ（ハッシュが一致しない行は使わない）
  if (row.refreshTokenHash !== sha256Hex(token)) return { action: 'reject', reason: 'unknown' }
  if (row.revokedAt) return { action: 'reject', reason: 'revoked' }
  if (row.rotatedAt) {
    const leeway = Math.max(0, options?.reuseLeewayMs ?? 0)
    if (leeway > 0 && now.getTime() - row.rotatedAt.getTime() <= leeway) {
      return { action: 'reject', reason: 'retry-conflict' }
    }
    return { action: 'revoke-family', familyId: row.familyId, userId: row.userId, revokedAt: now }
  }
  if (row.expiresAt.getTime() <= now.getTime()) return { action: 'reject', reason: 'expired' }
  return { action: 'rotate', familyId: row.familyId, rotatedAt: now }
}

export type RotatedSession = {
  accessToken: string
  accessExpiresAt: Date
  refreshToken: string
  /** 新しい AppDevice の行（familyId は古い行と同じ） */
  device: { familyId: string; refreshTokenHash: string; expiresAt: Date; rotatedAt: null; revokedAt: null }
}

/** decideRefresh が 'rotate' を返したあとに、次のトークンを出す。 */
export function rotateSession(args: { familyId: string; now: Date; randomBytes: RandomBytes }): RotatedSession {
  const { familyId, now, randomBytes } = args
  const accessToken = generateOpaqueToken(randomBytes)
  const refreshToken = generateOpaqueToken(randomBytes)
  return {
    accessToken,
    accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
    refreshToken,
    device: {
      familyId,
      refreshTokenHash: sha256Hex(refreshToken),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
      rotatedAt: null,
      revokedAt: null,
    },
  }
}

/**
 * 端末の行が、いまログインに使える状態か。「ログイン中の端末」の一覧に出す行の判定にも使う。
 * 使える = 失効していない、ローテーション済みでない（最新の行）、期限内。
 */
export function isDeviceActive(row: Pick<DeviceRow, 'rotatedAt' | 'revokedAt' | 'expiresAt'>, now: Date): boolean {
  return !row.revokedAt && !row.rotatedAt && row.expiresAt.getTime() > now.getTime()
}

/**
 * 失効の書き込み内容。呼び出し側は次を1つの処理で行う。
 *  - AppDevice: familyId が同じ行の revokedAt（まだ null の行）に now を入れる。
 *  - Session: その系統で出した Session の行を消す（ログアウト・端末の失効・使い回しの検出・退会で共通）。
 * 戻り値は書き込む値。何を消すかは、呼び出し側が持つ系統の Session の特定の方法に従う。
 */
export function revocationPatch(now: Date): { revokedAt: Date } {
  return { revokedAt: now }
}

/** Session の行が、いま使えるか（期限切れの行は使わない）。 */
export function isSessionLive(session: { expires: Date } | null, now: Date): boolean {
  return Boolean(session) && (session as { expires: Date }).expires.getTime() > now.getTime()
}
