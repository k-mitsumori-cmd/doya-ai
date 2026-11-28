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
  /** USER / ADMIN。審査用ログインが、管理者のアカウントを通さないために読む */
  role?: string
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

/** 「ログイン中の端末」の一覧に出す列。リフレッシュトークンのハッシュ・プッシュトークン・メールは含めない */
export type DeviceListItem = {
  id: string
  deviceLabel: string | null
  platform: string
  lastUsedAt: Date | null
  createdAt: Date
  /** いまのアクセストークン（Session）の id。「いまの端末か」の判定にだけ使い、画面には返さない */
  sessionId: string | null
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
  /** この Session に対応する端末の系統を失効させ、この Session の行も消す（ログアウト）。その端末から引き渡した Web のセッションも消す */
  revokeBySessionId(sessionId: string, now: Date): Promise<void>
  /** このアクセストークン（Session）に対応する端末の行。無ければ null（アプリ用ではない通常のセッション） */
  findDeviceBySessionId(sessionId: string): Promise<{ id: string; userId: string; revokedAt: Date | null } | null>

  /**
   * そのユーザーの、いま使える端末（系統ごとに、まだ新しいトークンに替えていない行。失効していず、期限内）。新しい順。
   * 他人の端末は、userId の条件で決して含まれない。
   */
  listLiveDevices(userId: string, now: Date): Promise<DeviceListItem[]>
  /** id とユーザーの両方が一致する、いま使える端末の行。他人の id・失効・期限切れ・替え済みの行は null */
  findLiveDevice(id: string, userId: string, now: Date): Promise<DeviceRecord | null>
  /**
   * 端末にプッシュトークンを置く（null なら消す）。
   * 置けるのは、id・userId・sessionId（いまの Bearer の Session の id）がすべて一致し、いま使える行（替え済みでなく、失効していず、期限内）だけ。
   * 確認と更新は、条件つきの1文の更新（件数が1のときだけ成功）で行う。失効と同時に来ても、失効のあとにトークンは残らない。
   * 同じトークンをほかの行が持っていれば、ユーザーを問わず、同じ処理の中で外す（新しい登録が優先）。
   * 理由: プッシュトークンは、物理的な端末（アプリのインストール）を指す。1つのインストールで同時に使えるアプリのログインは1つで、いま新しくログインしたセッションが、その端末の持ち主。
   * 競合は DB の部分一意索引（生きている行の pushToken は一意。SQL 側にある）が守る。同時の登録で一意違反になったら、1回だけやり直し、それでも違反なら 'retry'。
   * 返り値: 'ok'、行が条件に合わない 'not-found'、'retry'。
   */
  setDevicePushToken(input: { id: string; userId: string; sessionId: string; token: string | null; now: Date }): Promise<'ok' | 'not-found' | 'retry'>

  /** 引き渡しのコード（ハッシュ）を作る。端末の行に結び付ける */
  createWebHandoff(input: { codeHash: string; challengeHash: string; userId: string; deviceId: string; nextPath: string; expiresAt: Date }): Promise<void>
  /** コード（ハッシュ）に結び付けた challengeHash を返す（未使用・期限内の行だけ。無ければ null）。消費はしない */
  getWebHandoffChallenge(codeHash: string, now: Date): Promise<string | null>
  /**
   * 引き渡しのコードを1回だけ使い、Web のセッション（アプリ用ではない通常の Session。AppDevice には結び付けない）を作る。1つの処理。
   * 使えるのは、未使用・期限内・challengeHash が一致し、ユーザーが退会していず、端末の系統が失効していないときだけ。条件つきの更新で原子的に取る（同時に何本来ても、1回しか成功しない）。
   * 作った Session の id を引き渡しの行に控える（端末のログアウトのとき、この Session も消すため）。使えなければ null。
   */
  consumeWebHandoff(input: { codeHash: string; challengeHash: string; now: Date; sessionToken: string; sessionExpires: Date }): Promise<{ userId: string; nextPath: string } | null>

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
