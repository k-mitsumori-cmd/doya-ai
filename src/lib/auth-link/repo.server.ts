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
      return prisma.user.findFirst({
        where: { deletedAt: null, OR: [{ emailNormalized }, { email: { equals: emailNormalized, mode: 'insensitive' } }] },
        select: { id: true },
      })
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
    async incrementLinkAttempts(id) {
      const r = await prisma.accountLinkRequest.update({ where: { id }, data: { attempts: { increment: 1 } }, select: { attempts: true } })
      return r.attempts
    },
    async consumeLinkRequest(id, now) {
      const r = await prisma.accountLinkRequest.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: now } })
      return r.count === 1
    },
  }
}
