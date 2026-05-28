import { prisma } from '@/lib/prisma'

interface UsageLimits {
  monthlyProjects: number
  companiesPerProject: number
  aiAnalysis: boolean
  approachGeneration: boolean
}

const PLAN_LIMITS: Record<string, UsageLimits> = {
  FREE: {
    monthlyProjects: 3,
    companiesPerProject: 20,
    aiAnalysis: false,
    approachGeneration: false,
  },
  LIGHT: {
    monthlyProjects: 10,
    companiesPerProject: 50,
    aiAnalysis: true,
    approachGeneration: false,
  },
  PRO: {
    monthlyProjects: 30,
    companiesPerProject: 100,
    aiAnalysis: true,
    approachGeneration: true,
  },
  ENTERPRISE: {
    monthlyProjects: 200,
    companiesPerProject: 500,
    aiAnalysis: true,
    approachGeneration: true,
  },
}

export function getPlanLimits(plan: string): UsageLimits {
  return PLAN_LIMITS[plan.toUpperCase()] || PLAN_LIMITS.FREE
}

export async function checkProjectLimit(userId: string, plan: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const limits = getPlanLimits(plan)
  if (limits.monthlyProjects === -1) {
    return { allowed: true, current: 0, limit: -1 }
  }

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const count = await prisma.doyalistProject.count({
    where: {
      userId,
      createdAt: { gte: startOfMonth },
    },
  })

  return {
    allowed: count < limits.monthlyProjects,
    current: count,
    limit: limits.monthlyProjects,
  }
}

export async function getMonthlyUsage(userId: string): Promise<{ creditsUsed: number; creditsLimit: number }> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const count = await prisma.doyalistProject.count({
    where: {
      userId,
      createdAt: { gte: startOfMonth },
    },
  })

  // Get user plan
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  const limits = getPlanLimits(user?.plan || 'FREE')

  return {
    creditsUsed: count,
    creditsLimit: limits.monthlyProjects === -1 ? 999 : limits.monthlyProjects,
  }
}
