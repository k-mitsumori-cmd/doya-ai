import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DashboardClient } from '@/components/allinone/DashboardClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AllinoneDashboardPage({
  params,
}: {
  params: { id: string }
}) {
  const analysis = await prisma.allinoneAnalysis.findUnique({
    where: { id: params.id },
    include: { chats: { orderBy: { createdAt: 'asc' } } },
  })
  if (!analysis) notFound()

  // Prisma の Date は JSON シリアライズできないので string に
  const safe = {
    ...analysis,
    createdAt: analysis.createdAt.toISOString(),
    updatedAt: analysis.updatedAt.toISOString(),
    chats: analysis.chats.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  }

  return <DashboardClient analysis={safe as any} />
}
