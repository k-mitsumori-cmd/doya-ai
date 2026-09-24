import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import crypto from 'crypto'

/**
 * ページ用: 未ログインなら /auth/signin にリダイレクト
 * ⚠️ callbackUrl を必ず付ける。付けないと signin 側の既定('/seo')が効いて
 *    ログイン後にドヤ記事作成へ飛ばされる
 * Server Action からは使わないこと（Action 内 redirect は Server Components error を引き起こす）
 */
export async function requirePromaneAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin?callbackUrl=/promane')
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
  return prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    if (users.length === 0) throw new Error('Promane account not found')

    const membership = await tx.promaneMember.findFirst({
      where: { userId, isActive: true },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    })
    if (membership) return membership.workspace

    // 所有WSのアクセス権が無効化されている場合は勝手に再有効化しない。
    const owned = await tx.promaneWorkspace.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } })
    if (owned) return null

    const user = await tx.user.findUnique({ where: { id: userId }, select: { name: true } })
    return tx.promaneWorkspace.create({
      data: {
        userId,
        name: 'マイワークスペース',
        slug: `ws-${crypto.randomBytes(8).toString('hex')}`,
        members: { create: { userId, role: 'owner', displayName: user?.name || 'オーナー' } },
      },
    })
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

/** Server Action用。閲覧用の所属確認と、更新・管理の権限確認を分離する。 */
export async function requireWritableWorkspace(slug: string, userId: string, adminOnly = false) {
  const workspace = await getWorkspaceBySlug(slug, userId)
  if (!workspace) throw new Error('ワークスペースにアクセスできません')
  const member = workspace.members.find((m) => m.userId === userId && m.isActive)
  const allowedRoles = adminOnly ? ['owner', 'admin'] : ['owner', 'admin', 'member']
  if (!member || !allowedRoles.includes(member.role)) {
    throw new Error(adminOnly ? 'この操作はオーナー・管理者のみ実行できます' : '閲覧専用のため変更できません')
  }
  return workspace
}
