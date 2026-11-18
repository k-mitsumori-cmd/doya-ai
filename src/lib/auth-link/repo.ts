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
  /** 正規化したメールで引く。emailNormalized がまだ埋まっていない既存の行は、User.email の大文字小文字を無視した一致でも見つける */
  findUserByEmail(emailNormalized: string): Promise<{ id: string } | null>
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
  /** 試した回数を1つ増やし、増やしたあとの値を返す */
  incrementLinkAttempts(id: string): Promise<number>
  /** まだ使われていない待ちだけを使用済みにする。使えたら true（同時の2回目は false） */
  consumeLinkRequest(id: string, now: Date): Promise<boolean>
}
