// ============================================
// ツール図鑑・実績バッジの事実を DB から数える（サーバーだけ）
// ============================================
// ⚠️ 読むだけ。書き込み・外部 API の呼び出しはしない。
// ⚠️ 組織で持つツールは「本人が ACTIVE なメンバーの組織」だけを数える（ほかの組織は数えない）。
// ⚠️ 1つのツールの数え方が落ちても、画面は出す（そのツールは「まだ」として出す）。
// ⚠️ 今は「本人が入っている組織」を合わせて数える。ドヤパワーの組織が入ったら、その組織にひもづく各ツールの組織で数え直す。
import { prisma } from '@/lib/prisma'
import { cleanBillingMonths } from './billing'
import type { CollectionFacts, ToolUsage } from './types'
import { excludeIds } from '@/lib/system-watch/marked-records'
import { systemWatchRecordIdsAll } from '@/lib/system-watch/marked-records-range'
import { EMPTY_USAGE, emptyFacts } from './types'

type Agg = { _count: { _all: number }; _min: { createdAt: Date | null } }

async function usage(run: () => Promise<Agg>): Promise<ToolUsage> {
  try {
    const a = await run()
    return { count: a._count._all, firstAt: a._min.createdAt ? a._min.createdAt.toISOString() : null }
  } catch {
    return EMPTY_USAGE
  }
}

async function ids(run: () => Promise<{ id: string }[]>): Promise<string[]> {
  try {
    return (await run()).map((r) => r.id)
  } catch {
    return []
  }
}

const agg = { _count: { _all: true }, _min: { createdAt: true } } as const
const none = async (): Promise<Agg> => ({ _count: { _all: 0 }, _min: { createdAt: null } })

export async function loadCollectionFacts(userId: string, now = new Date()): Promise<CollectionFacts> {
  const active = { userId, status: 'ACTIVE' }
  const [sfa, shodan, aishodan, aio, mensetsu, quote, income, expense, hr, kintai, promane] = await Promise.all([
    ids(() => prisma.sfaMember.findMany({ where: active, select: { organizationId: true } }).then((r) => r.map((m) => ({ id: m.organizationId })))),
    ids(() => prisma.shodanMember.findMany({ where: active, select: { organizationId: true } }).then((r) => r.map((m) => ({ id: m.organizationId })))),
    ids(() => prisma.aishodanMember.findMany({ where: active, select: { organizationId: true } }).then((r) => r.map((m) => ({ id: m.organizationId })))),
    ids(() => prisma.aioMember.findMany({ where: active, select: { organizationId: true } }).then((r) => r.map((m) => ({ id: m.organizationId })))),
    ids(() => prisma.mensetsuMember.findMany({ where: active, select: { organizationId: true } }).then((r) => r.map((m) => ({ id: m.organizationId })))),
    ids(() => prisma.quoteMember.findMany({ where: active, select: { organizationId: true } }).then((r) => r.map((m) => ({ id: m.organizationId })))),
    ids(() => prisma.incomeMember.findMany({ where: active, select: { organizationId: true } }).then((r) => r.map((m) => ({ id: m.organizationId })))),
    ids(() => prisma.expenseMember.findMany({ where: active, select: { organizationId: true } }).then((r) => r.map((m) => ({ id: m.organizationId })))),
    ids(() => prisma.hrOrganizationMember.findMany({ where: active, select: { organizationId: true } }).then((r) => r.map((m) => ({ id: m.organizationId })))),
    ids(() => prisma.kintaiMember.findMany({ where: active, select: { organizationId: true } }).then((r) => r.map((m) => ({ id: m.organizationId })))),
    ids(() => prisma.promaneMember.findMany({ where: { userId, isActive: true }, select: { workspaceId: true } }).then((r) => r.map((m) => ({ id: m.workspaceId })))),
  ])
  const org = (list: string[]) => ({ organizationId: { in: list } })
  // 自動点検（system-watch の B1）が本人の会社に毎日作る商談準備・見積書・スライドは数えない（2026-10-26 ユーザー決定）。
  // 名前の印ではなく、合図を確かめたルートが残した記録の ID で外す（marked-records.ts）
  const [watchShodan, watchQuote, watchSlide] = await Promise.all([
    systemWatchRecordIdsAll(prisma, 'shodan-preparation', shodan, now).catch(() => []),
    systemWatchRecordIdsAll(prisma, 'quote-document', quote, now).catch(() => []),
    systemWatchRecordIdsAll(prisma, 'doyaslide-project', [userId], now).catch(() => []),
  ])

  const [tools, quotesSent, invoicesIssued, paymentsRecorded, articlesDone, dealsWon, interviewsDone, projectsCompleted, schedules] = await Promise.all([
    Promise.all([
      // 本人の記録で数えるツール
      usage(() => prisma.seoArticle.aggregate({ where: { userId }, ...agg })),
      usage(() => prisma.generation.aggregate({ where: { userId, serviceId: 'banner' }, ...agg })),
      usage(() => prisma.adImageCampaign.aggregate({ where: { userId }, ...agg })),
      usage(() => prisma.personaProject.aggregate({ where: { userId }, ...agg })),
      usage(() => prisma.interviewProject.aggregate({ where: { userId }, ...agg })),
      usage(() => prisma.askLinkRun.aggregate({ where: { userId }, ...agg })),
      usage(() => prisma.popup.aggregate({ where: { userId }, ...agg })),
      usage(() => prisma.tenjikaiProject.aggregate({ where: { userId }, ...agg })),
      usage(() => prisma.doyalistProject.aggregate({ where: { userId }, ...agg })),
      usage(() => prisma.doyaSlideProject.aggregate({ where: { userId, ...excludeIds(watchSlide) }, ...agg })),
      usage(() => prisma.cunningSession.aggregate({ where: { userId }, ...agg })),
      usage(() => prisma.shanaiInterview.aggregate({ where: { userId }, ...agg })),
      // 組織で持つツール
      usage(() => (sfa.length ? prisma.sfaDeal.aggregate({ where: org(sfa), ...agg }) : none())),
      usage(() => (shodan.length ? prisma.shodanPreparation.aggregate({ where: { ...org(shodan), ...excludeIds(watchShodan) }, ...agg }) : none())),
      usage(() => (aishodan.length ? prisma.aishodanSession.aggregate({ where: org(aishodan), ...agg }) : none())),
      usage(() => (aio.length ? prisma.aioScan.aggregate({ where: org(aio), ...agg }) : none())),
      usage(() => (mensetsu.length ? prisma.mensetsuSession.aggregate({ where: org(mensetsu), ...agg }) : none())),
      usage(() => (quote.length ? prisma.quoteDocument.aggregate({ where: { ...org(quote), ...excludeIds(watchQuote) }, ...agg }) : none())),
      usage(() => (income.length ? prisma.incomeInvoice.aggregate({ where: org(income), ...agg }) : none())),
      usage(() => (expense.length ? prisma.expenseBill.aggregate({ where: org(expense), ...agg }) : none())),
      usage(() => (hr.length ? prisma.hrEmployee.aggregate({ where: org(hr), ...agg }) : none())),
      usage(() => (kintai.length ? prisma.kintaiAttendance.aggregate({ where: { employee: org(kintai) }, ...agg }) : none())),
      usage(() => (promane.length ? prisma.promaneProject.aggregate({ where: { workspaceId: { in: promane } }, ...agg }) : none())),
    ]),
    usage(() => (quote.length ? prisma.quoteDocument.aggregate({ where: { ...org(quote), ...excludeIds(watchQuote), OR: [{ sentAt: { not: null } }, { status: 'sent' }] }, ...agg }) : none())),
    usage(() => (income.length ? prisma.incomeInvoice.aggregate({ where: { ...org(income), confirmedAt: { not: null }, status: { not: 'void' } }, ...agg }) : none())),
    usage(() => (income.length ? prisma.incomePayment.aggregate({ where: org(income), ...agg }) : none())),
    usage(() => prisma.seoArticle.aggregate({ where: { userId, status: 'DONE' }, ...agg })),
    usage(() => (sfa.length ? prisma.sfaDeal.aggregate({ where: { ...org(sfa), status: 'won' }, ...agg }) : none())),
    usage(() => (mensetsu.length ? prisma.mensetsuSession.aggregate({ where: { ...org(mensetsu), status: { in: ['completed', 'evaluated'] } }, ...agg }) : none())),
    usage(() => (promane.length ? prisma.promaneProject.aggregate({ where: { workspaceId: { in: promane }, status: 'completed' }, ...agg }) : none())),
    income.length
      ? prisma.incomeRevenueSchedule
          .findMany({
            // 直近の13か月だけ見る（古い月まで全部は読まない）
            where: { ...org(income), plannedIssueDate: { gte: new Date(now.getTime() - 400 * 86400_000) } },
            select: { plannedIssueDate: true, status: true },
            take: 20000,
          })
          .catch(() => [])
      : Promise.resolve([]),
  ])

  const TOOL_IDS = ['seo', 'banner', 'adimage', 'persona', 'interview', 'asklink', 'popup', 'tenjikai', 'doyalist', 'doyaslide', 'cunning', 'shanai',
    'sfa', 'shodan', 'aishodan', 'aio', 'mensetsu', 'quote', 'income', 'expense', 'hr', 'kintai', 'promane'] as const
  const facts = emptyFacts()
  TOOL_IDS.forEach((id, i) => { facts.tools[id] = tools[i] })
  return {
    ...facts,
    quotesSent,
    invoicesIssued,
    paymentsRecorded,
    articlesDone,
    dealsWon,
    interviewsDone,
    projectsCompleted,
    cleanBillingMonths: cleanBillingMonths(schedules, now),
  }
}
