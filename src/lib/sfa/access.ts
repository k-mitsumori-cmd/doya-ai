// ============================================
// ドヤ営業管理（SFA）認証・組織スコープ（kintai準拠）
// ============================================
import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE_HIERARCHY, type SfaContext, type SfaRole } from './types'
import { DEFAULT_STAGES } from './constants'

/** リクエストから対象ワークスペース(slug)を取り出す。クエリ ?org= 優先、無ければヘッダ x-sfa-org */
export function orgSlugFrom(req: NextRequest): string | undefined {
  try {
    const q = new URL(req.url).searchParams.get('org')?.trim() // URL APIがデコード済み
    if (q) return q
  } catch {
    /* noop */
  }
  const h = req.headers.get('x-sfa-org')
  if (!h) return undefined
  // クライアントは encodeURIComponent して送る（日本語slug対応）。デコードに失敗したら原文を使う。
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
 * 全API共通の入口。
 * orgSlug を指定するとそのワークスペースの ACTIVE メンバーシップを返す（他人の組織には null）。
 * 未指定なら最後に参加した組織を返す（入口/オンボーディング判定用のフォールバック）。
 */
export async function getSfaContext(orgSlug?: string): Promise<SfaContext | null> {
  const userId = await resolveUserId()
  if (!userId) return null

  // 指定slugを優先。見つからなければ所属組織（最新）にフォールバック。
  // いずれも userId でスコープしているため、他人の組織は決して解決されない（IDOR安全）。
  let membership = orgSlug
    ? await prisma.sfaMember.findFirst({
        where: { userId, status: 'ACTIVE', organization: { slug: orgSlug } },
        include: { organization: true },
      })
    : null
  if (!membership) {
    membership = await prisma.sfaMember.findFirst({
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
    role: membership.role as SfaRole,
    memberId: membership.id,
  }
}

/** ログイン中ユーザーが所属する全ワークスペース（切替メニュー用） */
export async function listMemberships(): Promise<{ slug: string; name: string; role: SfaRole }[]> {
  const userId = await resolveUserId()
  if (!userId) return []
  const memberships = await prisma.sfaMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })
  return memberships.map((m) => ({
    slug: m.organization.slug,
    name: m.organization.name,
    role: m.role as SfaRole,
  }))
}

export function hasMinRole(currentRole: string, minRole: SfaRole): boolean {
  return (ROLE_HIERARCHY[currentRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0)
}

/** 初回オンボーディング：組織＋オーナー＋既定パイプライン＋サンプルデータを作成（冪等） */
export async function getOrCreateOrganization(userId: string, orgName: string, memberName: string) {
  const existing = await prisma.sfaMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
  })
  if (existing) return existing.organization

  // slugはASCIIのみ（URL/HTTPヘッダ安全）。日本語社名はハイフン除去後に空になるため org-<timestamp> にフォールバック
  const base = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `org-${Date.now()}`
  const dup = await prisma.sfaOrganization.findUnique({ where: { slug: base } })
  const slug = dup ? `${base}-${Date.now()}` : base

  const org = await prisma.sfaOrganization.create({ data: { name: orgName, slug } })

  await prisma.sfaMember.create({
    data: { organizationId: org.id, userId, role: 'owner', status: 'ACTIVE', name: memberName, acceptedAt: new Date() },
  })

  // 既定パイプライン＋ステージ
  const pipeline = await prisma.sfaPipeline.create({ data: { organizationId: org.id, name: '標準パイプライン', isDefault: true } })
  await prisma.sfaStage.createMany({
    data: DEFAULT_STAGES.map((s) => ({
      pipelineId: pipeline.id,
      name: s.name,
      order: s.order,
      probability: s.probability,
      color: s.color,
      isWon: !!s.isWon,
      isLost: !!s.isLost,
    })),
  })

  // サンプルデータ（空画面回避）
  const stages = await prisma.sfaStage.findMany({ where: { pipelineId: pipeline.id }, orderBy: { order: 'asc' } })
  const proposalStage = stages.find((s) => s.name === '提案') || stages[0]
  const account = await prisma.sfaAccount.create({
    data: { organizationId: org.id, name: '株式会社サンプル商事', industry: '製造業', prefecture: '東京都', note: '初期サンプル。編集・削除OK' },
  })
  await prisma.sfaDeal.create({
    data: {
      organizationId: org.id,
      accountId: account.id,
      name: 'サンプル新規導入案件',
      amount: BigInt(1000000),
      stageId: proposalStage?.id || null,
      probability: proposalStage?.probability ?? 40,
      status: 'open',
      lastActivityAt: new Date(),
    },
  })
  await prisma.sfaTask.create({
    data: { organizationId: org.id, title: '初回ヒアリングの日程調整', status: 'open', accountId: account.id },
  })

  return org
}
