// ============================================
// ドヤAIO（AI可視性・AEO）認証・組織スコープ（SFA準拠）
// 全API共通の入口。userId でスコープするため他組織は決して解決されない（IDOR安全）。
// ============================================
import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE_HIERARCHY, type AioContext, type AioRole } from './types'

/** リクエストから対象ワークスペース(slug)を取り出す。クエリ ?org= 優先、無ければヘッダ x-aio-org */
export function orgSlugFrom(req: NextRequest): string | undefined {
  try {
    const q = new URL(req.url).searchParams.get('org')?.trim() // URL APIがデコード済み
    if (q) return q
  } catch {
    /* noop */
  }
  const h = req.headers.get('x-aio-org')
  if (!h) return undefined
  // クライアントは encodeURIComponent して送る（日本語slug対応）。デコード失敗時は原文。
  try {
    return decodeURIComponent(h).trim() || undefined
  } catch {
    return h.trim() || undefined
  }
}

/** ログイン中ユーザーのIDを解決（session優先、無ければemailから） */
async function resolveUserId(): Promise<string | undefined> {
  const session = await getServerSession(authOptions)
  let userId = (session?.user as any)?.id as string | undefined
  if (!userId && session?.user?.email) {
    const dbUser = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    userId = dbUser?.id
  }
  return userId
}

/**
 * orgSlug を指定するとそのワークスペースの ACTIVE メンバーシップを返す（他人の組織には null）。
 * 未指定なら最後に参加した組織を返す（入口/オンボーディング判定用のフォールバック）。
 */
export async function getAioContext(orgSlug?: string): Promise<AioContext | null> {
  const userId = await resolveUserId()
  if (!userId) return null

  let membership = orgSlug
    ? await prisma.aioMember.findFirst({
        where: { userId, status: 'ACTIVE', organization: { slug: orgSlug } },
        include: { organization: true },
      })
    : null
  if (!membership) {
    membership = await prisma.aioMember.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
    })
  }
  if (!membership) return null

  return {
    userId,
    organizationId: membership.organizationId,
    organizationSlug: membership.organization.slug,
    role: membership.role as AioRole,
    memberId: membership.id,
  }
}

/** 指定ユーザーが所属する全ワークスペース（userId既知の場合。セッション再解決を避ける） */
export async function listMembershipsFor(userId: string): Promise<{ slug: string; name: string; role: AioRole }[]> {
  const memberships = await prisma.aioMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })
  return memberships.map((m) => ({ slug: m.organization.slug, name: m.organization.name, role: m.role as AioRole }))
}

/** ログイン中ユーザーが所属する全ワークスペース（切替メニュー用） */
export async function listMemberships(): Promise<{ slug: string; name: string; role: AioRole }[]> {
  const userId = await resolveUserId()
  if (!userId) return []
  const memberships = await prisma.aioMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })
  return memberships.map((m) => ({
    slug: m.organization.slug,
    name: m.organization.name,
    role: m.role as AioRole,
  }))
}

export function hasMinRole(currentRole: string, minRole: AioRole): boolean {
  return (ROLE_HIERARCHY[currentRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0)
}

/** 初回オンボーディング：組織＋オーナーを作成（冪等） */
export async function getOrCreateOrganization(userId: string, orgName: string, memberName: string) {
  const existing = await prisma.aioMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
  })
  if (existing) return existing.organization

  // slugはASCIIのみ（URL/HTTPヘッダ安全）。日本語社名はハイフン除去後に空になるため org-<timestamp> にフォールバック
  const base = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `org-${Date.now()}`
  const dup = await prisma.aioOrganization.findUnique({ where: { slug: base } })
  const slug = dup ? `${base}-${Date.now()}` : base

  const org = await prisma.aioOrganization.create({ data: { name: orgName, slug } })
  await prisma.aioMember.create({
    data: { organizationId: org.id, userId, role: 'owner', status: 'ACTIVE', name: memberName, acceptedAt: new Date() },
  })
  return org
}
