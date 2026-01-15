import { StrategyAppLayout } from '@/components/StrategyAppLayout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { StrategyDashboard } from '@/components/StrategyDashboard'

export default async function StrategyPage() {
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user
  const userId = session?.user?.id

  // プラン取得
  let currentPlan: 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE' | 'UNKNOWN' = 'GUEST'
  if (userId) {
    const subscription = await prisma.userServiceSubscription.findUnique({
      where: {
        userId_serviceId: {
          userId,
          serviceId: 'strategy',
        },
      },
    })
    const plan = subscription?.plan || 'FREE'
    if (plan === 'PRO') currentPlan = 'PRO'
    else if (plan === 'ENTERPRISE') currentPlan = 'ENTERPRISE'
    else currentPlan = 'FREE'
  }

  // 戦略プロジェクト一覧取得
  const projects = userId
    ? await prisma.strategyProject.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    : []

  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined

  return (
    <StrategyAppLayout currentPlan={currentPlan} isLoggedIn={isLoggedIn} firstLoginAt={firstLoginAt}>
      <StrategyDashboard projects={projects} isLoggedIn={isLoggedIn} />
    </StrategyAppLayout>
  )
}
