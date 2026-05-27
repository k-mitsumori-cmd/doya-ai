import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export async function requirePromaneAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  return session
}

export async function getOrCreateWorkspace(userId: string) {
  const membership = await prisma.promaneMember.findFirst({
    where: { userId, isActive: true },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })
  if (membership) return membership.workspace

  const user = await prisma.user.findUnique({ where: { id: userId } })
  return prisma.promaneWorkspace.create({
    data: {
      userId,
      name: 'マイワークスペース',
      slug: `ws-${userId.slice(0, 8)}`,
      members: {
        create: {
          userId,
          role: 'owner',
          displayName: user?.name || 'オーナー',
        },
      },
    },
  })
}

export async function getWorkspaceBySlug(slug: string, userId: string) {
  return prisma.promaneWorkspace.findFirst({
    where: {
      slug,
      members: { some: { userId, isActive: true } },
    },
    include: {
      members: { where: { userId, isActive: true } },
    },
  })
}

export async function getCurrentMember(workspaceId: string, userId: string) {
  return prisma.promaneMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
}
