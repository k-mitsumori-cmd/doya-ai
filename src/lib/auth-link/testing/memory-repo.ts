import type { AuthRepo, DeviceListItem, DeviceRecord, LinkRequestRecord, NewAccount, NewDevice, UserRecord } from '../repo'
import { UniqueViolationError } from '../repo'

/** 試験用のメモリの repo。本物の DB には接続しない。 */
export type MemUser = UserRecord & { emailNormalized: string | null; emailVerifiedForLink?: boolean }
export type MemAccount = NewAccount & { userId: string }
export type MemSession = { id: string; sessionToken: string; userId: string; expires: Date }
export type MemDevice = DeviceRecord & { createdAt: Date; lastUsedAt: Date | null; pushToken: string | null }

export class MemoryRepo implements AuthRepo {
  users = new Map<string, MemUser>()
  accounts: MemAccount[] = []
  sessions: MemSession[] = []
  devices: MemDevice[] = []
  links = new Map<string, LinkRequestRecord>()
  companies = new Set<string>()
  handoffs: Array<{ id: string; codeHash: string; challengeHash: string; userId: string; deviceId: string; nextPath: string; expiresAt: Date; consumedAt: Date | null; webSessionId: string | null }> = []
  private seq = 0
  nextId(prefix: string) { return `${prefix}${++this.seq}` }

  addUser(u: Partial<MemUser> & { id: string }): MemUser {
    const user: MemUser = { name: null, image: null, email: null, plan: 'FREE', deletedAt: null, emailNormalized: null, ...u }
    this.users.set(user.id, user)
    return user
  }

  async findAccount(provider: string, providerAccountId: string) {
    const a = this.accounts.find((x) => x.provider === provider && x.providerAccountId === providerAccountId)
    return a ? { userId: a.userId } : null
  }
  async findUserByEmail(n: string) {
    const hit = [...this.users.values()].find((u) => u.emailNormalized === n || (u.email ?? '').toLowerCase() === n)
    return hit ? { id: hit.id, emailVerified: hit.emailVerifiedForLink !== false } : null
  }
  async getUser(id: string) { return this.users.get(id) ?? null }
  async createUserWithAccount(input: Parameters<AuthRepo['createUserWithAccount']>[0]) {
    if (input.email && [...this.users.values()].some((u) => u.email === input.email)) throw new UniqueViolationError()
    const id = this.nextId('user-')
    this.addUser({ id, email: input.email, emailNormalized: input.emailNormalized, name: input.name, image: input.image })
    this.accounts.push({ ...input.account, userId: id })
    return { id }
  }
  async touchAccount(provider: string, id: string, patch: { providerEmail: string | null; emailVerified: boolean | null }) {
    const a = this.accounts.find((x) => x.provider === provider && x.providerAccountId === id)
    if (a) Object.assign(a, patch)
  }
  async addAccount(userId: string, account: NewAccount) { this.accounts.push({ ...account, userId }) }
  async hasCompany(userId: string) { return this.companies.has(userId) }

  async createSession(input: { userId: string; sessionToken: string; sessionExpires: Date; device: NewDevice }) {
    const sid = this.nextId('sess-')
    this.sessions.push({ id: sid, sessionToken: input.sessionToken, userId: input.userId, expires: input.sessionExpires })
    this.devices.push({ id: this.nextId('dev-'), userId: input.userId, ...input.device, sessionId: sid, rotatedAt: null, revokedAt: null, createdAt: new Date(), lastUsedAt: new Date(), pushToken: null })
  }
  async findDeviceByHash(h: string) { return this.devices.find((d) => d.refreshTokenHash === h) ?? null }
  async rotateDevice(input: { old: DeviceRecord; rotatedAt: Date; userId: string; sessionToken: string; sessionExpires: Date; device: NewDevice }): Promise<boolean> {
    const old = this.devices.find((d) => d.id === input.old.id)!
    if (old.rotatedAt) return false
    old.rotatedAt = input.rotatedAt
    this.sessions = this.sessions.filter((s) => s.id !== old.sessionId)
    const sid = this.nextId('sess-')
    this.sessions.push({ id: sid, sessionToken: input.sessionToken, userId: input.userId, expires: input.sessionExpires })
    // 新しい行へ、プッシュトークンを引き継ぐ（トークンを替えるたびに通知の許可が消えないように）
    this.devices.push({ id: this.nextId('dev-'), userId: input.userId, ...input.device, sessionId: sid, rotatedAt: null, revokedAt: null, createdAt: new Date(), lastUsedAt: input.rotatedAt, pushToken: old.pushToken })
    old.pushToken = null
    return true
  }
  async revokeFamily(familyId: string, now: Date) {
    const ids = new Set<string>()
    const deviceIds = new Set<string>()
    for (const d of this.devices.filter((x) => x.familyId === familyId)) {
      if (!d.revokedAt) d.revokedAt = now
      d.pushToken = null
      if (d.sessionId) ids.add(d.sessionId)
      deviceIds.add(d.id)
    }
    // その端末から引き渡した Web のセッションも消す
    for (const h of this.handoffs) if (deviceIds.has(h.deviceId) && h.webSessionId) ids.add(h.webSessionId)
    this.sessions = this.sessions.filter((s) => !ids.has(s.id))
  }
  async findSession(token: string) {
    const s = this.sessions.find((x) => x.sessionToken === token)
    return s ? { id: s.id, userId: s.userId, expires: s.expires } : null
  }
  async revokeBySessionId(sessionId: string, now: Date) {
    const d = this.devices.find((x) => x.sessionId === sessionId)
    if (d) await this.revokeFamily(d.familyId, now)
    this.sessions = this.sessions.filter((s) => s.id !== sessionId)
  }

  async findDeviceBySessionId(sessionId: string) {
    const d = this.devices.find((x) => x.sessionId === sessionId)
    return d ? { id: d.id, userId: d.userId, revokedAt: d.revokedAt } : null
  }
  private isLive(d: MemDevice, now: Date) { return !d.rotatedAt && !d.revokedAt && d.expiresAt.getTime() > now.getTime() }
  async listLiveDevices(userId: string, now: Date): Promise<DeviceListItem[]> {
    return this.devices
      .filter((d) => d.userId === userId && this.isLive(d, now))
      .map((d) => ({ id: d.id, deviceLabel: d.deviceLabel, platform: d.platform, lastUsedAt: d.lastUsedAt, createdAt: d.createdAt, sessionId: d.sessionId }))
      .reverse()
  }
  async findLiveDevice(id: string, userId: string, now: Date) {
    return this.devices.find((d) => d.id === id && d.userId === userId && this.isLive(d, now)) ?? null
  }
  async setDevicePushToken(id: string, userId: string, token: string | null, now: Date) {
    const d = this.devices.find((x) => x.id === id && x.userId === userId && this.isLive(x, now))
    if (!d) return false
    if (token) for (const o of this.devices) if (o.pushToken === token) o.pushToken = null
    d.pushToken = token
    return true
  }
  async createWebHandoff(i: { codeHash: string; challengeHash: string; userId: string; deviceId: string; nextPath: string; expiresAt: Date }) {
    this.handoffs.push({ id: this.nextId('hand-'), ...i, consumedAt: null, webSessionId: null })
  }
  // 確認から更新までを、await を挟まない1つの同期の区間で行う（同時に何本来ても、1回しか成功しない）
  async getWebHandoffChallenge(codeHash: string, now: Date) {
    const h = this.handoffs.find((x) => x.codeHash === codeHash)
    return h && !h.consumedAt && h.expiresAt.getTime() > now.getTime() ? h.challengeHash : null
  }
  async consumeWebHandoff(i: { codeHash: string; challengeHash: string; now: Date; sessionToken: string; sessionExpires: Date }) {
    const h = this.handoffs.find((x) => x.codeHash === i.codeHash)
    if (!h || h.consumedAt || h.challengeHash !== i.challengeHash || h.expiresAt.getTime() <= i.now.getTime()) return null
    const user = this.users.get(h.userId)
    const device = this.devices.find((d) => d.id === h.deviceId)
    if (!user || user.deletedAt || !device || device.revokedAt) return null
    h.consumedAt = i.now
    const sid = this.nextId('sess-')
    this.sessions.push({ id: sid, sessionToken: i.sessionToken, userId: h.userId, expires: i.sessionExpires })
    h.webSessionId = sid
    return { userId: h.userId, nextPath: h.nextPath }
  }

  async getLinkRequest(id: string) { return this.links.get(id) ?? null }
  async findLiveLinkRequest(provider: string, sub: string, userId: string, now: Date) {
    return [...this.links.values()].find((l) => l.provider === provider && l.providerAccountId === sub && l.userId === userId && !l.consumedAt && l.expiresAt.getTime() > now.getTime()) ?? null
  }
  async createLinkRequest(i: { id: string; userId: string; provider: string; providerAccountId: string; providerEmail: string | null; expiresAt: Date }) {
    this.links.set(i.id, { ...i, codeHash: null, attempts: 0, consumedAt: null, createdAt: new Date() })
  }
  async setLinkCode(id: string, codeHash: string | null) { this.links.get(id)!.codeHash = codeHash }
  // 取得は1つの同期の区間で行う（確認と加算の間に await を入れない）。同時に何本来ても、上限を超えて取れない
  async takeLinkAttempt(id: string, max: number) {
    const l = this.links.get(id)
    if (!l || l.consumedAt || l.attempts >= max) return null
    l.attempts += 1
    return l.attempts
  }
  usedIdTokens = new Set<string>()
  async claimIdToken(hash: string) {
    if (this.usedIdTokens.has(hash)) return false
    this.usedIdTokens.add(hash)
    return true
  }
  async setLinkCodeIfEmpty(id: string, codeHash: string) {
    const l = this.links.get(id)
    if (!l || l.codeHash) return false
    l.codeHash = codeHash
    return true
  }
  async consumeLinkRequestAndAddAccount(id: string, now: Date, userId: string, account: NewAccount | null) {
    const l = this.links.get(id)
    if (!l || l.consumedAt) return false
    l.consumedAt = now
    if (account) this.accounts.push({ ...account, userId })
    return true
  }
  async consumeLinkRequest(id: string, now: Date) {
    const l = this.links.get(id)
    if (!l || l.consumedAt) return false
    l.consumedAt = now
    return true
  }
}
