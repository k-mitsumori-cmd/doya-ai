import type { AuthRepo, DeviceRecord, LinkRequestRecord, NewAccount, NewDevice, UserRecord } from '../repo'
import { UniqueViolationError } from '../repo'

/** 試験用のメモリの repo。本物の DB には接続しない。 */
export type MemUser = UserRecord & { emailNormalized: string | null }
export type MemAccount = NewAccount & { userId: string }
export type MemSession = { id: string; sessionToken: string; userId: string; expires: Date }

export class MemoryRepo implements AuthRepo {
  users = new Map<string, MemUser>()
  accounts: MemAccount[] = []
  sessions: MemSession[] = []
  devices: DeviceRecord[] = []
  links = new Map<string, LinkRequestRecord>()
  companies = new Set<string>()
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
    return hit ? { id: hit.id } : null
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
    this.devices.push({ id: this.nextId('dev-'), userId: input.userId, ...input.device, sessionId: sid, rotatedAt: null, revokedAt: null })
  }
  async findDeviceByHash(h: string) { return this.devices.find((d) => d.refreshTokenHash === h) ?? null }
  async rotateDevice(input: { old: DeviceRecord; rotatedAt: Date; userId: string; sessionToken: string; sessionExpires: Date; device: NewDevice }): Promise<boolean> {
    const old = this.devices.find((d) => d.id === input.old.id)!
    if (old.rotatedAt) return false
    old.rotatedAt = input.rotatedAt
    this.sessions = this.sessions.filter((s) => s.id !== old.sessionId)
    const sid = this.nextId('sess-')
    this.sessions.push({ id: sid, sessionToken: input.sessionToken, userId: input.userId, expires: input.sessionExpires })
    this.devices.push({ id: this.nextId('dev-'), userId: input.userId, ...input.device, sessionId: sid, rotatedAt: null, revokedAt: null })
    return true
  }
  async revokeFamily(familyId: string, now: Date) {
    const ids = new Set<string>()
    for (const d of this.devices.filter((x) => x.familyId === familyId)) {
      if (!d.revokedAt) d.revokedAt = now
      if (d.sessionId) ids.add(d.sessionId)
    }
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

  async getLinkRequest(id: string) { return this.links.get(id) ?? null }
  async findLiveLinkRequest(provider: string, sub: string, userId: string, now: Date) {
    return [...this.links.values()].find((l) => l.provider === provider && l.providerAccountId === sub && l.userId === userId && !l.consumedAt && l.expiresAt.getTime() > now.getTime()) ?? null
  }
  async createLinkRequest(i: { id: string; userId: string; provider: string; providerAccountId: string; providerEmail: string | null; expiresAt: Date }) {
    this.links.set(i.id, { ...i, codeHash: null, attempts: 0, consumedAt: null, createdAt: new Date() })
  }
  async setLinkCode(id: string, codeHash: string | null) { this.links.get(id)!.codeHash = codeHash }
  async incrementLinkAttempts(id: string) { const l = this.links.get(id)!; l.attempts += 1; return l.attempts }
  async consumeLinkRequest(id: string, now: Date) {
    const l = this.links.get(id)
    if (!l || l.consumedAt) return false
    l.consumedAt = now
    return true
  }
}
