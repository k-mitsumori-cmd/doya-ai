// ============================================
// ドヤAI商談（aishodan）認証・組織スコープ（mensetsu / sfa 準拠）
// ============================================
// ホスト側の全APIはこのファイルを入口にする。
//
// ⚠️ ゲスト向けAPI（/api/aishodan/room/*）はここを通さない。
//    未ログインの見込み客が叩くため、roomToken でスコープし、
//    返却フィールドをホワイトリストすること（lib/aishodan/public.ts）。
// getAishodanContext() は必ず userId で ACTIVE メンバーシップをスコープするため、
// 他組織のデータは決して解決されない（IDOR安全）。
//
import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE_HIERARCHY, hasMinRole, type AishodanContext, type AishodanRole } from './types'

export { hasMinRole, ROLE_HIERARCHY }

/** リクエストから対象組織(slug)を取り出す。クエリ ?org= 優先、無ければヘッダ x-aishodan-org */
export function orgSlugFrom(req: NextRequest): string | undefined {
  try {
    const q = new URL(req.url).searchParams.get('org')?.trim() // URL APIがデコード済み
    if (q) return q
  } catch {
    /* noop */
  }
  const h = req.headers.get('x-aishodan-org')
  if (!h) return undefined
  // クライアントは encodeURIComponent して送る（日本語slug対応）。デコード失敗時は原文。
  try {
    return decodeURIComponent(h).trim() || undefined
  } catch {
    return h.trim() || undefined
  }
}

/** ログイン中ユーザーのIDを解決（session優先、無ければemailから） */
export async function resolveUserId(): Promise<string | undefined> {
  const session = await getServerSession(authOptions)
  let userId = (session?.user as any)?.id as string | undefined
  if (!userId && session?.user?.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    userId = dbUser?.id
  }
  return userId
}

/**
 * 全API共通の入口。
 * orgSlug 指定時はその組織の ACTIVE メンバーシップを返す（他人の組織なら null）。
 * 未指定なら最後に参加した組織にフォールバックする。
 */
export async function getAishodanContext(orgSlug?: string): Promise<AishodanContext | null> {
  const userId = await resolveUserId()
  if (!userId) return null

  let membership = orgSlug
    ? await prisma.aishodanMember.findFirst({
        where: { userId, status: 'ACTIVE', organization: { slug: orgSlug } },
        include: { organization: true },
      })
    : null
  if (!membership) {
    membership = await prisma.aishodanMember.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
    })
  }
  if (!membership) return null

  return {
    userId,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    role: membership.role as AishodanRole,
  }
}

/** ログイン中ユーザーが所属する全組織（切替メニュー用） */
export async function listMemberships(): Promise<{ slug: string; name: string; role: AishodanRole }[]> {
  const userId = await resolveUserId()
  if (!userId) return []
  const memberships = await prisma.aishodanMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })
  return memberships.map((m) => ({
    slug: m.organization.slug,
    name: m.organization.name,
    role: m.role as AishodanRole,
  }))
}

/** 初回オンボーディング：組織＋オーナーを作成（冪等） */
export async function getOrCreateOrganization(userId: string, orgName: string, memberName?: string) {
  const existing = await prisma.aishodanMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
  })
  if (existing) return existing.organization

  // slugはASCIIのみ（URL/HTTPヘッダ安全）。日本語社名は空になるため org-<timestamp> にフォールバック
  const base =
    orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `org-${Date.now()}`
  const dup = await prisma.aishodanOrganization.findUnique({ where: { slug: base } })
  const slug = dup ? `${base}-${Date.now()}` : base

  const org = await prisma.aishodanOrganization.create({ data: { name: orgName, slug } })
  await prisma.aishodanMember.create({
    data: {
      organizationId: org.id,
      userId,
      role: 'owner',
      status: 'ACTIVE',
      name: memberName || null,
      acceptedAt: new Date(),
    },
  })
  return org
}
