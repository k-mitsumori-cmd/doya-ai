// ============================================
// ドヤ見積もりAI（quote）認証・組織スコープ（mensetsu / sfa 準拠）
// ============================================
// 全てのAPIはこのファイルを入口にする。
// getQuoteContext() は必ず userId で ACTIVE メンバーシップをスコープするため、
// 他組織のデータは決して解決されない（IDOR安全）。
//
import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE_HIERARCHY, hasMinRole, type QuoteContext, type QuoteRole } from './types'

export { hasMinRole, ROLE_HIERARCHY }

/** リクエストから対象組織(slug)を取り出す。クエリ ?org= 優先、無ければヘッダ x-quote-org */
export function orgSlugFrom(req: NextRequest): string | undefined {
  try {
    const q = new URL(req.url).searchParams.get('org')?.trim() // URL APIがデコード済み
    if (q) return q
  } catch {
    /* noop */
  }
  const h = req.headers.get('x-quote-org')
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
export async function getQuoteContext(orgSlug?: string): Promise<QuoteContext | null> {
  const userId = await resolveUserId()
  if (!userId) return null

  let membership = orgSlug
    ? await prisma.quoteMember.findFirst({
        where: { userId, status: 'ACTIVE', organization: { slug: orgSlug } },
        include: { organization: true },
      })
    : null
  if (!membership) {
    // ⚠️ 既定の組織は「自分が作った組織」を優先し、次に古い順にする。
    //    以前は createdAt の降順（最後に入った組織）にしていたため、
    //    他人の組織に招待されて受諾した瞬間に作業場所が黙って切り替わり、
    //    自分が作った見積書・商談に一覧からもURLからも到達できなくなっていた
    //    （組織切替UIも無かったため戻る手段が無い）。
    membership = await prisma.quoteMember.findFirst({
      where: { userId, status: 'ACTIVE', role: 'owner' },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    })
  }
  if (!membership) {
    membership = await prisma.quoteMember.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    })
  }
  if (!membership) return null

  return {
    userId,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    role: membership.role as QuoteRole,
  }
}

/** ログイン中ユーザーが所属する全組織（切替メニュー用） */
export async function listMemberships(): Promise<{ slug: string; name: string; role: QuoteRole }[]> {
  const userId = await resolveUserId()
  if (!userId) return []
  const memberships = await prisma.quoteMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })
  return memberships.map((m) => ({
    slug: m.organization.slug,
    name: m.organization.name,
    role: m.role as QuoteRole,
  }))
}

/** 初回オンボーディング：組織＋オーナーを作成（冪等） */
export async function getOrCreateOrganization(userId: string, orgName: string, memberName?: string) {
  const existing = await prisma.quoteMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
  })
  if (existing) return existing.organization

  // slugはASCIIのみ（URL/HTTPヘッダ安全）。日本語社名は空になるため org-<timestamp> にフォールバック
  const base =
    orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `org-${Date.now()}`
  const dup = await prisma.quoteOrganization.findUnique({ where: { slug: base } })
  const slug = dup ? `${base}-${Date.now()}` : base

  const org = await prisma.quoteOrganization.create({ data: { name: orgName, slug } })
  await prisma.quoteMember.create({
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
