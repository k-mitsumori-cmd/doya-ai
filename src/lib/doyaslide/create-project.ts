// ============================================
// ドヤスライド プロジェクト作成（月の上限つき・共通）
// ============================================
// POST /api/doyaslide/projects と POST /api/doyaslide/projects/from-quote の両方が使う。
// 月の作成数の判定と作成を、同じ User 行の FOR UPDATE ロックの内側で行う。
import { prisma } from '@/lib/prisma'
import { DOYASLIDE_PROJECT_SERVICE_ID, isSameMonth, monthStart } from '@/lib/doyaslide/limits'

export type NewProjectData = {
  userId: string
  title: string
  docType: string
  customBrief: string | null
  slideCount: number
  aspectRatio: string
  themeColor: string
  stylePreset: string
  status: string
}

/**
 * プロジェクトを作る。maxProjects が -1 なら無制限。
 * 今月の上限に達していれば何も作らず null を返す。
 */
export async function createProjectWithinLimit(data: NewProjectData, maxProjects: number) {
  if (maxProjects === -1) return prisma.doyaSlideProject.create({ data })
  const userId = data.userId
  return prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    if (users.length === 0) throw new Error('DoyaSlide account not found')
    const now = new Date()
    const [existing, ledger] = await Promise.all([
      tx.doyaSlideProject.count({ where: { userId, createdAt: { gte: monthStart(now) } } }),
      tx.userServiceSubscription.findUnique({
        where: { userId_serviceId: { userId, serviceId: DOYASLIDE_PROJECT_SERVICE_ID } },
        select: { monthlyUsage: true, lastUsageReset: true },
      }),
    ])
    const used = Math.max(existing, ledger && isSameMonth(ledger.lastUsageReset, now) ? ledger.monthlyUsage : 0)
    if (used >= maxProjects) return null
    const project = await tx.doyaSlideProject.create({ data })
    await tx.userServiceSubscription.upsert({
      where: { userId_serviceId: { userId, serviceId: DOYASLIDE_PROJECT_SERVICE_ID } },
      create: { userId, serviceId: DOYASLIDE_PROJECT_SERVICE_ID, monthlyUsage: used + 1, lastUsageReset: now },
      update: { monthlyUsage: used + 1, lastUsageReset: now },
    })
    return project
  })
}

export function limitReachedBody(maxProjects: number) {
  return {
    error: `今月のプロジェクト作成数が上限（${maxProjects}件）に達しています。プロプランではプロジェクト数の上限なく作成できます。`,
    code: 'LIMIT_REACHED',
    limit: maxProjects,
    upgradeUrl: '/doyaslide/pricing',
  }
}
