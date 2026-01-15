import { StrategyAppLayout } from '@/components/StrategyAppLayout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { StrategyDetailView } from '@/components/StrategyDetailView'
import { notFound } from 'next/navigation'

export default async function StrategyDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  const project = await prisma.strategyProject.findUnique({
    where: { id: params.id },
  })

  if (!project) {
    notFound()
  }

  // 権限チェック（自分のプロジェクトまたはゲストIDが一致）
  if (project.userId && project.userId !== userId) {
    notFound()
  }

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

  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined

  return (
    <StrategyAppLayout currentPlan={currentPlan} isLoggedIn={!!userId} firstLoginAt={firstLoginAt}>
      <StrategyDetailView project={project} />
    </StrategyAppLayout>
  )
}
