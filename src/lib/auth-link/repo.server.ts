import { Prisma, type PrismaClient } from '@prisma/client'
import { UniqueViolationError, type AuthRepo, type DeviceRecord, type LinkRequestRecord } from './repo'

/** AuthRepo の Prisma 版（本番）。規則は持たない。1つの処理にまとめるべき所は $transaction で包む。 */
export function createPrismaAuthRepo(prisma: PrismaClient): AuthRepo {
  const toDevice = (d: {
    id: string; userId: string; familyId: string; refreshTokenHash: string; rotatedAt: Date | null; revokedAt: Date | null
    expiresAt: Date; sessionId: string | null; deviceLabel: string | null; platform: string
  }): DeviceRecord => ({ ...d })

  const revokeFamily = async (familyId: string, now: Date) => {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.appDevice.findMany({ where: { familyId }, select: { sessionId: true } })
      const ids = rows.map((r) => r.sessionId).filter((x): x is string => Boolean(x))
      await tx.appDevice.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } })
      if (ids.length) await tx.session.deleteMany({ where: { id: { in: ids } } })
    })
  }

  return {
    async findAccount(provider, providerAccountId) {
      return prisma.account.findUnique({ where: { provider_providerAccountId: { provider, providerAccountId } }, select: { userId: true } })
    },
    async findUserByEmail(emailNormalized) {
      // emailNormalized があればそれで、まだ埋まっていない既存の行は lower(email) の一致で引く（ILIKE ではないので _ や % が一致に化けない）
      const rows = await prisma.$queryRaw<Array<{ id: string; emailVerified: Date | null }>>`
        SELECT id, "emailVerified" FROM "User"
        WHERE "deletedAt" IS NULL AND ("emailNormalized" = ${emailNormalized} OR ("emailNormalized" IS NULL AND lower(email) = ${emailNormalized}))
        ORDER BY "createdAt" ASC LIMIT 1`
      const u = rows[0]
      if (!u) return null
      let verified = u.emailVerified !== null
      if (!verified) {
        // provider が google の Account（Google は確認済みのメールだけを返す。既存の行は emailVerified が null）か、確認済みと明示された Account
        const acc = await prisma.account.findFirst({
          where: { userId: u.id, OR: [{ provider: 'google', NOT: { emailVerified: false } }, { emailVerified: true }] },
          select: { id: true },
        })
        verified = Boolean(acc)
      }
      return { id: u.id, emailVerified: verified }
    },
    async getUser(id) {
      return prisma.user.findUnique({ where: { id }, select: { id: true, name: true, image: true, email: true, plan: true, deletedAt: true } })
    },
    async createUserWithAccount(input) {
      try {
        const u = await prisma.user.create({
          data: {
            email: input.email, emailNormalized: input.emailNormalized, emailVerified: input.emailVerified,
            name: input.name, image: input.image,
            accounts: { create: { type: 'oidc', provider: input.account.provider, providerAccountId: input.account.providerAccountId, providerEmail: input.account.providerEmail, emailVerified: input.account.emailVerified } },
          },
          select: { id: true },
        })
        return u
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new UniqueViolationError()
        throw e
      }
    },
    async touchAccount(provider, providerAccountId, patch) {
      await prisma.account.updateMany({ where: { provider, providerAccountId }, data: patch })
    },
    async addAccount(userId, a) {
      await prisma.account.create({ data: { userId, type: 'oidc', provider: a.provider, providerAccountId: a.providerAccountId, providerEmail: a.providerEmail, emailVerified: a.emailVerified } })
    },
    async hasCompany(userId) {
      return Boolean(await prisma.accountCompany.findUnique({ where: { userId }, select: { id: true } }))
    },

    async createSession(input) {
      await prisma.$transaction(async (tx) => {
        const s = await tx.session.create({ data: { sessionToken: input.sessionToken, userId: input.userId, expires: input.sessionExpires }, select: { id: true } })
        await tx.appDevice.create({
          data: {
            userId: input.userId, deviceLabel: input.device.deviceLabel, platform: input.device.platform,
            refreshTokenHash: input.device.refreshTokenHash, familyId: input.device.familyId, sessionId: s.id,
            expiresAt: input.device.expiresAt, lastUsedAt: new Date(),
          },
        })
      })
    },
    async findDeviceByHash(refreshTokenHash) {
      const d = await prisma.appDevice.findUnique({ where: { refreshTokenHash } })
      return d ? toDevice(d) : null
    },
    async rotateDevice(input) {
      return prisma.$transaction(async (tx) => {
        // 先に取った方だけが進める（rotatedAt が空の行だけを更新して、件数が1かを見る）
        const claimed = await tx.appDevice.updateMany({ where: { id: input.old.id, rotatedAt: null, revokedAt: null }, data: { rotatedAt: input.rotatedAt, lastUsedAt: input.rotatedAt } })
        if (claimed.count !== 1) return false
        if (input.old.sessionId) await tx.session.deleteMany({ where: { id: input.old.sessionId } })
        const s = await tx.session.create({ data: { sessionToken: input.sessionToken, userId: input.userId, expires: input.sessionExpires }, select: { id: true } })
        await tx.appDevice.create({
          data: {
            userId: input.userId, deviceLabel: input.device.deviceLabel, platform: input.device.platform,
            refreshTokenHash: input.device.refreshTokenHash, familyId: input.device.familyId, sessionId: s.id,
            expiresAt: input.device.expiresAt, lastUsedAt: input.rotatedAt,
          },
        })
        return true
      })
    },
    revokeFamily,
    async findSession(sessionToken) {
      return prisma.session.findUnique({ where: { sessionToken }, select: { id: true, userId: true, expires: true } })
    },
    async revokeBySessionId(sessionId, now) {
      const d = await prisma.appDevice.findFirst({ where: { sessionId }, select: { familyId: true } })
      if (d) await revokeFamily(d.familyId, now)
      await prisma.session.deleteMany({ where: { id: sessionId } })
    },

    async getLinkRequest(id) {
      return (await prisma.accountLinkRequest.findUnique({ where: { id } })) as LinkRequestRecord | null
    },
    async findLiveLinkRequest(provider, providerAccountId, userId, now) {
      return (await prisma.accountLinkRequest.findFirst({
        where: { provider, providerAccountId, userId, consumedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
      })) as LinkRequestRecord | null
    },
    async createLinkRequest(i) {
      await prisma.accountLinkRequest.create({ data: i })
    },
    async setLinkCode(id, codeHash) {
      await prisma.accountLinkRequest.update({ where: { id }, data: { codeHash } })
    },
    async setLinkCodeIfEmpty(id, codeHash) {
      const r = await prisma.accountLinkRequest.updateMany({ where: { id, codeHash: null, consumedAt: null }, data: { codeHash } })
      return r.count === 1
    },
    async takeLinkAttempt(id, max) {
      // 条件つきの1回の更新（attempts < max かつ未使用）。同時に来ても、上限を超えては増えない
      const r = await prisma.accountLinkRequest.updateMany({ where: { id, consumedAt: null, attempts: { lt: max } }, data: { attempts: { increment: 1 } } })
      if (r.count !== 1) return null
      const row = await prisma.accountLinkRequest.findUnique({ where: { id }, select: { attempts: true } })
      return row?.attempts ?? max
    },
    async claimIdToken(hash, expiresAt) {
      try {
        await prisma.appIdTokenUse.create({ data: { hash, expiresAt } })
        return true
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false
        throw e
      }
    },
    async consumeLinkRequestAndAddAccount(id, now, userId, a) {
      return prisma.$transaction(async (tx) => {
        const r = await tx.accountLinkRequest.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: now } })
        if (r.count !== 1) return false
        if (a) await tx.account.create({ data: { userId, type: 'oidc', provider: a.provider, providerAccountId: a.providerAccountId, providerEmail: a.providerEmail, emailVerified: a.emailVerified } })
        return true
      })
    },
    async consumeLinkRequest(id, now) {
      const r = await prisma.accountLinkRequest.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: now } })
      return r.count === 1
    },
  }
}
