import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

/**
 * ページ用: 未ログインなら /auth/signin にリダイレクト
 * Server Action からは使わないこと（Action 内 redirect は Server Components error を引き起こす）
 */
export async function requirePromaneAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  return session
}

/**
 * Server Action 用: redirect ではなく Error を投げる
 * クライアント側で catch して toast 表示できる
 */
export async function requirePromaneAuthAction() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) {
    throw new Error('ログインセッションが切れています。ページを再読み込みしてください。')
  }
  return { session, userId: userId as string }
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
