import { prisma } from '@/lib/prisma'
import { getAioBilling } from './billing'
import { scanQuota } from './quota'
import { SCAN_STALE_MS } from './types'

export async function getAioUsage(organizationId: string) {
  const billing = await getAioBilling(prisma, organizationId)
  if (!billing) return null
  const now = new Date()
  const quota = scanQuota(billing.plan, now)
  // Expired processing is excluded just as it is at reservation time.
  const where = {
    organizationId,
    OR: [
      { status: { in: ['done', 'deleted'] } },
      { status: 'processing', updatedAt: { gte: new Date(now.getTime() - SCAN_STALE_MS) } },
    ],
  }
  const [total, used] = await Promise.all([
    prisma.aioScan.count({ where }),
    prisma.aioScan.count({ where: { ...where, createdAt: { gte: quota.since } } }),
  ])
  return {
    title: 'この組織のスキャン', unit: '回', total,
    planLabel: !quota.paid ? 'FREE' : billing.plan.toUpperCase() === 'ENTERPRISE' ? 'ENTERPRISE' : 'PRO',
    meters: [{ label: quota.paid ? '今月' : '直近7日', used, limit: quota.limit }],
  }
}
