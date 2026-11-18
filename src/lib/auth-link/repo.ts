import type { DeviceRow } from './device-token'

/**
 * アプリ用の認証が DB に触る所を、この型の小さな関数に分ける（repository 形式）。
 * 本番は repo.server.ts（Prisma）、試験は testing/memory-repo.ts（メモリ）。
 * 規則（何を決めるか）は app-auth-service.ts にあり、DB の書き方はここから先だけが知っている。
 */

export type UserRecord = {
  id: string
  name: string | null
  image: string | null
  email: string | null
  plan: string
  deletedAt: Date | null
}

export type NewAccount = {
  provider: string
  providerAccountId: string
  providerEmail: string | null
  emailVerified: boolean | null
}

export type DeviceRecord = DeviceRow & {
  sessionId: string | null
  deviceLabel: string | null
  platform: string
}

export type NewDevice = {
  familyId: string
  refreshTokenHash: string
  expiresAt: Date
  deviceLabel: string | null
  platform: string
}

export type LinkRequestRecord = {
  id: string
  userId: string | null
  provider: string
  providerAccountId: string
  providerEmail: string | null
  codeHash: string | null
  expiresAt: Date
  attempts: number
  consumedAt: Date | null
  createdAt: Date
}

/** 一意の制約に当たった（同時に同じ人を作ろうとした）ときに、repo が投げる。 */
export class UniqueViolationError extends Error {
  constructor() {
    super('unique violation')
    this.name = 'UniqueViolationError'
  }
}

export interface AuthRepo {
  findAccount(provider: string, providerAccountId: string): Promise<{ userId: string } | null>
  /**
   * 正規化したメールで引く。emailNormalized がまだ埋まっていない既存の行は、lower(User.email) の一致でも見つける。
   * emailVerified は、そのユーザーのメールが確認済みか（User.emailVerified がある、provider が google の Account がある（Google は確認済みのメールだけを返す）、
   * または Account.emailVerified が true）。確認済みでないメールのユーザーは、メールでは結び付けの対象にしない。
   */
  findUserByEmail(emailNormalized: string): Promise<{ id: string; emailVerified: boolean } | null>
  getUser(id: string): Promise<UserRecord | null>
  /** User と Account を1つの処理で作る。User.email が重なったら UniqueViolationError */
  createUserWithAccount(input: {
    email: string | null
    emailNormalized: string | null
    emailVerified: Date | null
    name: string | null
    image: string | null
    account: NewAccount
  }): Promise<{ id: string }>
  touchAccount(provider: string, providerAccountId: string, patch: { providerEmail: string | null; emailVerified: boolean | null }): Promise<void>
  addAccount(userId: string, account: NewAccount): Promise<void>
  hasCompany(userId: string): Promise<boolean>

  /** Session の行と AppDevice の行を1つの処理で作る（AppDevice.sessionId に Session.id を入れる） */
  createSession(input: { userId: string; sessionToken: string; sessionExpires: Date; device: NewDevice & { refreshTokenHash: string } }): Promise<void>
  findDeviceByHash(refreshTokenHash: string): Promise<DeviceRecord | null>
  /**
   * 古い行に rotatedAt を入れ、古い Session を消し、新しい Session と新しい AppDevice（同じ familyId）を作る。1つの処理。
   * 古い行がまだ rotatedAt の無い行のときだけ進める。同時の2回目（先に取られた）は何も書かず false を返す。
   */
  rotateDevice(input: {
    old: DeviceRecord
    rotatedAt: Date
    userId: string
    sessionToken: string
    sessionExpires: Date
    device: NewDevice
  }): Promise<boolean>
  /** 系統の全行に revokedAt を入れ（まだ null の行）、系統の Session の行を全部消す */
  revokeFamily(familyId: string, now: Date): Promise<void>
  findSession(sessionToken: string): Promise<{ id: string; userId: string; expires: Date } | null>
  /** この Session に対応する端末の系統を失効させ、この Session の行も消す（ログアウト） */
  revokeBySessionId(sessionId: string, now: Date): Promise<void>

  getLinkRequest(id: string): Promise<LinkRequestRecord | null>
  findLiveLinkRequest(provider: string, providerAccountId: string, userId: string, now: Date): Promise<LinkRequestRecord | null>
  createLinkRequest(input: { id: string; userId: string; provider: string; providerAccountId: string; providerEmail: string | null; expiresAt: Date }): Promise<void>
  setLinkCode(id: string, codeHash: string | null): Promise<void>
  /**
   * 照合の前に、試せる回数を1つ取る（原子的。同時に何本来ても、上限を超えて取れない）。
   * 条件つきの更新（attempts < max かつ未使用）が成功したら、取ったあとの回数を返す。取れなければ null（429 にする）。
   */
  takeLinkAttempt(id: string, max: number): Promise<number | null>
  /** 使った id_token のハッシュを控える。すでに控えてあれば false（2回めの使用）。期限を過ぎた行は、あとで消す（次の段） */
  claimIdToken(hash: string, expiresAt: Date): Promise<boolean>
  /** まだ使われていない待ちだけを使用済みにする。使えたら true（同時の2回目は false） */
  consumeLinkRequest(id: string, now: Date): Promise<boolean>
  /**
   * 待ちを使用済みにすることと、Account を足すことを、1つの処理で行う（途中で止まっても、片方だけが残らない）。
   * 待ちがすでに使われていれば何も足さず false。account が null のときは、使用済みにするだけ（すでに付いているとき）。
   */
  consumeLinkRequestAndAddAccount(id: string, now: Date, userId: string, account: NewAccount | null): Promise<boolean>
  /** 確認コードを置く。codeHash が空の待ちにだけ置ける（先に取った1回だけ成功。同時の2回目は false） */
  setLinkCodeIfEmpty(id: string, codeHash: string): Promise<boolean>
}
