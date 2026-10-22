// ============================================
// ミッションの画面のために、DB の既存の記録を読む
// ============================================
// ⚠️ 読むだけ。ドヤパワーの付与はしない（台帳 ui-next/doyapower-ledger の担当）。
// ⚠️ 有料の外部 API は呼ばない。集計は DB だけ。
// ⚠️ userId はいつもセッションから決めたものを渡す。組織は、その人の ACTIVE のメンバーシップだけから選ぶ（他社は読めない）。
// ⚠️ 1つのツールの読み取りに失敗しても、ほかは出す（失敗したツールは「まだ使っていない」と同じ扱い）。
import { prisma } from '@/lib/prisma'
import type { MissionAction } from './actions'
import type { AchievementKind } from './achievements'
import { jstMonthRange } from './jst'
import type { QuestFacts } from './rules'
import { buildMissionsView, type MissionsView } from './view'

const ROLES = ['owner', 'admin', 'manager', 'member']

/** 経営ホームと同じ選び方: オーナーの組織を先に、無ければ最初に入った組織 */
async function pickOrg(find: (where: Record<string, unknown>) => Promise<{ organizationId: string } | null>, userId: string) {
  return (
    (await find({ userId, status: 'ACTIVE', role: 'owner' })) ??
    (await find({ userId, status: 'ACTIVE', role: { in: ROLES } }))
  )?.organizationId ?? null
}

const soft = <T>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback)

async function quoteActions(orgId: string, monthStart: Date): Promise<MissionAction[]> {
  const select = {
    id: true, title: true, clientCompany: true, totalExclTax: true, confirmedAt: true, sentAt: true, updatedAt: true,
    lineItems: { select: { itemName: true, qty: true, unitPrice: true } },
  } as const
  const issued = { organizationId: orgId, status: { in: ['confirmed', 'sent'] } }
  // 今月の分と、最初の見積のクエストのための古い分
  const [recent, earliest] = await Promise.all([
    prisma.quoteDocument.findMany({ where: { ...issued, confirmedAt: { gte: monthStart } }, select, orderBy: { confirmedAt: 'asc' }, take: 500 }),
    prisma.quoteDocument.findMany({ where: issued, select, orderBy: { confirmedAt: 'asc' }, take: 30 }),
  ])
  const byId = new Map([...earliest, ...recent].map((q) => [q.id, q]))
  return [...byId.values()].map((q) => ({
    kind: 'quote_issued' as const,
    id: q.id,
    at: (q.confirmedAt ?? q.sentAt ?? q.updatedAt).toISOString(),
    title: q.title,
    clientCompany: q.clientCompany,
    totalExclTax: q.totalExclTax,
    lines: q.lineItems,
  }))
}

async function sfaActions(orgId: string, monthStart: Date): Promise<MissionAction[]> {
  const actSelect = { id: true, type: true, subject: true, body: true, aiSummary: true, transcriptId: true, createdAt: true } as const
  const [recentActs, earliestActs, savedDeals, wonDeals] = await Promise.all([
    prisma.sfaActivity.findMany({ where: { organizationId: orgId, createdAt: { gte: monthStart } }, select: actSelect, orderBy: { createdAt: 'asc' }, take: 1000 }),
    prisma.sfaActivity.findMany({ where: { organizationId: orgId }, select: actSelect, orderBy: { createdAt: 'asc' }, take: 30 }),
    prisma.sfaDeal.findMany({
      where: { organizationId: orgId, isActive: true, createdAt: { gte: monthStart } },
      select: { id: true, name: true, amount: true, expectedCloseDate: true, createdAt: true },
      take: 1000,
    }),
    prisma.sfaDeal.findMany({
      where: { organizationId: orgId, status: 'won', wonAt: { gte: monthStart } },
      select: { id: true, name: true, amount: true, wonAt: true },
      take: 1000,
    }),
  ])
  const acts = new Map([...earliestActs, ...recentActs].map((a) => [a.id, a]))
  return [
    ...[...acts.values()].map((a) => ({
      kind: 'activity_logged' as const,
      id: a.id,
      at: a.createdAt.toISOString(),
      type: a.type,
      subject: a.subject,
      body: a.body,
      // 文字起こしから作った記録、AI の要約しか無い記録は、人の操作として数えない
      aiGenerated: Boolean(a.transcriptId) || (Boolean(a.aiSummary) && !(a.body ?? '').trim()),
    })),
    ...savedDeals.map((d) => ({
      kind: 'deal_saved' as const,
      id: d.id,
      at: d.createdAt.toISOString(),
      name: d.name,
      amount: Number(d.amount),
      expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
    })),
    ...wonDeals.map((d) => ({ kind: 'deal_won' as const, id: d.id, at: d.wonAt!.toISOString(), name: d.name, amount: Number(d.amount) })),
  ]
}

async function acceptedInvites(userId: string, quoteOrg: string | null, sfaOrg: string | null) {
  const where = (orgId: string) => ({ organizationId: orgId, status: 'ACTIVE', acceptedAt: { not: null }, userId: { not: userId } })
  const select = { acceptedAt: true } as const
  const [q, s] = await Promise.all([
    quoteOrg ? soft(prisma.quoteMember.findMany({ where: where(quoteOrg), select, take: 20 }), []) : [],
    sfaOrg ? soft(prisma.sfaMember.findMany({ where: where(sfaOrg), select, take: 20 }), []) : [],
  ])
  return [...q, ...s].filter((m) => m.acceptedAt).map((m) => ({ at: m.acceptedAt!.toISOString() }))
}

async function achievementCounts(userId: string, quoteOrg: string | null, shodanOrg: string | null, start: Date, end: Date) {
  const inMonth = { gte: start, lt: end }
  const [seo, banner, copy, interview, quote, shodan] = await Promise.all([
    soft(prisma.seoArticle.count({ where: { userId, status: 'DONE', createdAt: inMonth } }), 0),
    soft(prisma.generation.count({ where: { userId, serviceId: 'banner', createdAt: inMonth } }), 0),
    soft(prisma.generation.count({ where: { userId, serviceId: 'copy', createdAt: inMonth } }), 0),
    // 仕上げた日の記録が無いので、完了の状態で今月に更新されたものを数える
    soft(prisma.interviewProject.count({ where: { userId, status: 'COMPLETED', updatedAt: inMonth } }), 0),
    quoteOrg ? soft(prisma.quoteDocument.count({ where: { organizationId: quoteOrg, status: { in: ['confirmed', 'sent'] }, confirmedAt: inMonth } }), 0) : 0,
    shodanOrg ? soft(prisma.shodanPreparation.count({ where: { organizationId: shodanOrg, status: 'done', createdAt: inMonth } }), 0) : 0,
  ])
  const counts: Partial<Record<AchievementKind, number>> = { seo_article: seo, banner, copy, interview, quote, shodan_prep: shodan }
  return counts
}

export async function loadMissionsView(userId: string, now: Date = new Date()): Promise<MissionsView> {
  const { start, end } = jstMonthRange(now)
  const [quoteOrg, sfaOrg, shodanOrg, company] = await Promise.all([
    soft(pickOrg((where) => prisma.quoteMember.findFirst({ where, select: { organizationId: true }, orderBy: { createdAt: 'asc' } }), userId), null),
    soft(pickOrg((where) => prisma.sfaMember.findFirst({ where, select: { organizationId: true }, orderBy: { createdAt: 'asc' } }), userId), null),
    soft(pickOrg((where) => prisma.shodanMember.findFirst({ where, select: { organizationId: true }, orderBy: { createdAt: 'asc' } }), userId), null),
    // ⚠️ 本番の DB に account_companies の表が入るまでは、読むと失敗する。そのときは未登録として扱う
    soft(prisma.accountCompany.findUnique({ where: { userId }, select: { name: true, industry: true, websiteUrl: true, updatedAt: true } }), null),
  ])
  const [qa, sa, invites, counts] = await Promise.all([
    quoteOrg ? soft(quoteActions(quoteOrg, start), []) : [],
    sfaOrg ? soft(sfaActions(sfaOrg, start), []) : [],
    acceptedInvites(userId, quoteOrg, sfaOrg),
    achievementCounts(userId, quoteOrg, shodanOrg, start, end),
  ])
  const facts: QuestFacts = {
    company: company ? { name: company.name, industry: company.industry, websiteUrl: company.websiteUrl, at: company.updatedAt.toISOString() } : null,
    acceptedInvites: invites,
    actions: [...qa, ...sa],
  }
  return buildMissionsView({ companyName: company?.name ?? null, facts, counts, tools: { quote: Boolean(quoteOrg), sfa: Boolean(sfaOrg) } }, now)
}
