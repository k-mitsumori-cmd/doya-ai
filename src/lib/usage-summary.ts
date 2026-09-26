// ============================================
// サイドバーに出す「作った数 / 残り」の集計（全サービス共通）
// ============================================
// ⚠️ 上限の数字はここに書かない。各サービスの正本（pricing.ts / plan-limit.ts /
//    adimage/access.ts など）から引く。二重管理すると
//    「表示は残っているのに実行が弾かれる」状態になる。
//
// ⚠️ 数え方はサービスごとに違う（累計・月次・日次、テーブルも別）。
//    追加するときは必ず、実際に上限判定しているコードと同じ数え方にすること。
import { prisma } from '@/lib/prisma'
import { getPersonaUsage } from '@/lib/persona/usage'
import {
  BANNER_PRICING,
  DOYALIST_PRICING,
  PERSONA_PRICING,
  SEO_PRICING,
  getBannerMonthlyLimitByUserPlan,
  getPersonaDailyLimitByUserPlan,
  getSeoMonthlyLimitByUserPlan,
  shouldResetDailyUsage,
  shouldResetMonthlyUsage,
} from '@/lib/pricing'
import { FREE_LIMITS, PRO_MONTHLY_LIMITS, ENTERPRISE_MONTHLY_LIMITS } from '@/lib/plan-limit'
import { isPaidPlan } from '@/lib/unified-plan'
import { PREP_STALE_MS, SHODAN_MONTHLY_LIMIT } from '@/lib/shodan/types'

/** 1本の枠。limit が null なら上限なし */
export interface UsageMeter {
  /** 「今日」「今月」など */
  label: string
  used: number
  limit: number | null
}

export interface UsageSummary {
  /** 「作った画像」「実施した面接」など、見出しに出す言葉 */
  title: string
  /** 数える単位。「枚」「件」「回」 */
  unit: string
  /** これまでの累計。null なら大きな数字は出さない */
  total: number | null
  meters: UsageMeter[]
  planLabel: string
}

/** JST の当日0時（UTC Date） */
export function jstStartOfTodayUtc(): Date {
  const jst = new Date(Date.now() + 9 * 3600_000)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - 9 * 3600_000)
}

/** JST の当月1日0時（UTC Date） */
export function jstStartOfMonthUtc(): Date {
  const jst = new Date(Date.now() + 9 * 3600_000)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 3600_000)
}

/**
 * UserServiceSubscription に貯めている回数を読む。
 * ⚠️ リセットは「次に生成したとき」に行われる遅延方式なので、月をまたいだ直後は
 *    古い数字が残っている（実測: banner の lastUsageReset が7ヶ月前で月234のまま）。
 *    そのまま表示すると「使い切りました」と嘘をつくため、同じ判定でここでも0に均す。
 */
async function subscriptionUsage(
  userId: string,
  serviceId: string,
  period: 'daily' | 'monthly'
): Promise<number> {
  const sub = await prisma.userServiceSubscription.findUnique({
    where: { userId_serviceId: { userId, serviceId } },
    select: { dailyUsage: true, monthlyUsage: true, lastUsageReset: true },
  })
  if (!sub) return 0
  if (period === 'daily') {
    return shouldResetDailyUsage(sub.lastUsageReset) ? 0 : sub.dailyUsage || 0
  }
  return shouldResetMonthlyUsage(sub.lastUsageReset) ? 0 : sub.monthlyUsage || 0
}

/** -1 は「上限なし」の意味なので null に均す */
function norm(limit: number): number | null {
  return limit < 0 ? null : limit
}

function planLabelOf(plan: string | null | undefined): string {
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return 'エンタープライズ'
  if (p === 'LIGHT') return 'ライト'
  return isPaidPlan(p) ? 'プロ' : '無料'
}

/** 上限判定と同じ組織を選ぶ。明示された他組織は null として拒否する。 */
async function orgIdsOf(
  model: 'mensetsuMember' | 'aishodanMember' | 'quoteMember' | 'shodanMember' | 'aioMember',
  userId: string,
  orgSlug?: string
): Promise<string[] | null> {
  const members = (prisma as any)[model]
  let row
  if (orgSlug) {
    row = await members.findFirst({
      where: { userId, status: 'ACTIVE', organization: { slug: orgSlug } },
      select: { organizationId: true },
    })
    if (!row) return null
  } else if (model === 'quoteMember' || model === 'aishodanMember') {
    // 両サービスの access.ts と同じく、自分が作った組織を優先する。
    row = await members.findFirst({
      where: { userId, status: 'ACTIVE', role: 'owner' },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    })
    row ??= await members.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    })
  } else {
    // 面接官・商談準備の既定組織は最後に参加した組織。
    row = await members.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: { organizationId: true },
    })
  }
  return row ? [row.organizationId] : []
}

/** 組織スコープ型の共通処理（無料=累計 / 有料=月次。plan-limit.ts の判定と同じ形） */
async function orgScoped(opts: {
  title: string
  unit: string
  key: keyof typeof FREE_LIMITS
  plan: string | null | undefined
  countAll: (orgIds: string[]) => Promise<number>
  countSince: (orgIds: string[], since: Date) => Promise<number>
  orgIds: string[]
}): Promise<UsageSummary> {
  const { title, unit, key, plan, countAll, countSince, orgIds } = opts
  const p = String(plan || 'FREE').toUpperCase()
  const total = orgIds.length ? await countAll(orgIds) : 0

  if (isPaidPlan(p)) {
    const table = p === 'ENTERPRISE' ? ENTERPRISE_MONTHLY_LIMITS : PRO_MONTHLY_LIMITS
    const limit = table[key]
    const used = orgIds.length ? await countSince(orgIds, jstStartOfMonthUtc()) : 0
    return {
      title,
      unit,
      total,
      planLabel: planLabelOf(p),
      meters: [{ label: '今月', used, limit }],
    }
  }
  // 無料は累計で数える
  return {
    title,
    unit,
    total,
    planLabel: planLabelOf(p),
    meters: [{ label: 'これまで', used: total, limit: FREE_LIMITS[key] }],
  }
}

/**
 * サービス1件ぶんの使用状況。
 * 対応していないサービスは null（サイドバーは何も出さない）。
 */
export async function getUsageSummary(
  service: string,
  userId: string,
  plan: string | null | undefined,
  orgSlug?: string
): Promise<UsageSummary | null> {
  const planLabel = planLabelOf(plan)

  switch (service) {
    // ---- 画像を作るもの（枚数が実費に直結する）----
    case 'adimage': {
      const where = { userId }
      const [total, today, month, budget] = await Promise.all([
        prisma.adImageCreative.count({ where: { concept: { campaign: where } } }),
        prisma.adImageCreative.count({
          where: { concept: { campaign: where }, createdAt: { gte: jstStartOfTodayUtc() } },
        }),
        prisma.adImageCreative.count({
          where: { concept: { campaign: where }, createdAt: { gte: jstStartOfMonthUtc() } },
        }),
        import('@/lib/adimage/image-budget').then(({ readImageBudgetUsage }) => readImageBudgetUsage(userId)),
      ])
      // ⚠️ 上限は adimage/access.ts が正本。ここでは同じ値を参照するだけ
      const { DAILY_IMAGE_LIMIT, MONTHLY_IMAGE_LIMIT } = await import('@/lib/adimage/access')
      const p = (isPaidPlan(plan) ? 'PRO' : 'FREE') as 'PRO' | 'FREE'
      return {
        title: '作った画像',
        unit: '枚',
        total,
        planLabel,
        meters: [
          { label: '今日', used: budget?.today ?? today, limit: DAILY_IMAGE_LIMIT[p] },
          { label: '今月', used: budget?.month ?? month, limit: MONTHLY_IMAGE_LIMIT[p] },
        ],
      }
    }

    case 'banner': {
      // Match the subscription row used by the generation endpoints, including legacy plans.
      const sub = await prisma.userServiceSubscription.findUnique({
        where: { userId_serviceId: { userId, serviceId: 'banner' } },
        select: { plan: true, monthlyUsage: true, lastUsageReset: true },
      })
      const bannerPlan = sub?.plan || plan || 'FREE'
      return {
        title: '作ったバナー',
        unit: '枚',
        total: null,
        planLabel: planLabelOf(bannerPlan),
        meters: [{
          label: '今月',
          used: !sub || shouldResetMonthlyUsage(sub.lastUsageReset) ? 0 : sub.monthlyUsage || 0,
          limit: norm(getBannerMonthlyLimitByUserPlan(bannerPlan) ?? BANNER_PRICING.freeLimit),
        }],
      }
    }

    case 'seo': {
      return {
        title: '書いた記事',
        unit: '本',
        total: null,
        planLabel,
        meters: [
          {
            label: '今月',
            used: await subscriptionUsage(userId, 'seo', 'monthly'),
            limit: norm(getSeoMonthlyLimitByUserPlan(plan) ?? SEO_PRICING.freeLimit),
          },
        ],
      }
    }

    case 'persona': {
      const usage = await getPersonaUsage(prisma, userId)
      if (!usage) return null
      return {
        title: '作ったペルソナ', unit: '件', total: null, planLabel: usage.planLabel,
        meters: [{ label: '今日（処理中を含む）', used: usage.text.used + usage.text.reserved, limit: norm(usage.text.limit) }],
      }
    }

    // ---- 組織スコープ型 ----
    case 'mensetsu': {
      const orgIds = await orgIdsOf('mensetsuMember', userId, orgSlug)
      if (!orgIds) return null
      return orgScoped({
        title: '実施した面接',
        unit: '件',
        key: 'mensetsuSessions',
        plan,
        orgIds,
        countAll: (ids) => prisma.mensetsuSession.count({ where: { organizationId: { in: ids } } }),
        countSince: (ids, since) =>
          prisma.mensetsuSession.count({
            where: { organizationId: { in: ids }, createdAt: { gte: since } },
          }),
      })
    }

    case 'aishodan': {
      const orgIds = await orgIdsOf('aishodanMember', userId, orgSlug)
      if (!orgIds) return null
      // 公開商談ルームの上限判定は組織オーナーのプランを使う。
      const owner = orgIds[0] ? await prisma.aishodanMember.findFirst({
        where: { organizationId: orgIds[0], status: 'ACTIVE', role: 'owner', userId: { not: null } },
        select: { userId: true },
        orderBy: { createdAt: 'asc' },
      }) : null
      const ownerPlan = owner?.userId
        ? (await prisma.user.findUnique({ where: { id: owner.userId }, select: { plan: true } }))?.plan
        : 'FREE'
      return orgScoped({
        title: '実施した商談',
        unit: '件',
        key: 'aishodanSessions',
        plan: ownerPlan,
        orgIds,
        countAll: (ids) =>
          prisma.aishodanSession.count({
            where: { organizationId: { in: ids }, room: { isPreview: false } },
          }),
        countSince: (ids, since) =>
          prisma.aishodanSession.count({
            where: {
              organizationId: { in: ids },
              room: { isPreview: false },
              createdAt: { gte: since },
            },
          }),
      })
    }

    case 'quote': {
      const orgIds = await orgIdsOf('quoteMember', userId, orgSlug)
      if (!orgIds) return null
      return orgScoped({
        title: '作った見積書',
        unit: '件',
        key: 'quoteDocuments',
        plan,
        orgIds,
        countAll: (ids) => prisma.quoteDocument.count({ where: { organizationId: { in: ids } } }),
        countSince: (ids, since) =>
          prisma.quoteDocument.count({
            where: { organizationId: { in: ids }, createdAt: { gte: since } },
          }),
      })
    }

    case 'shodan': {
      const orgIds = await orgIdsOf('shodanMember', userId, orgSlug)
      if (!orgIds) return null
      const total = orgIds.length
        ? await prisma.shodanPreparation.count({ where: { organizationId: { in: orgIds } } })
        : 0
      // ⚠️ 数え方をルート（api/shodan/preparations）と必ず揃える。
      //    失敗した調査や、止まったままの processing を含めて数えていたため、
      //    APIはまだ受け付けるのに画面だけ「使い切りました」と赤くなっていた。
      const staleBefore = new Date(Date.now() - PREP_STALE_MS)
      const used = orgIds.length
        ? await prisma.shodanPreparation.count({
            where: {
              organizationId: { in: orgIds },
              createdAt: { gte: jstStartOfMonthUtc() },
              OR: [
                { status: 'done' },
                { status: 'researched' },
                { status: 'processing', updatedAt: { gte: staleBefore } },
              ],
            },
          })
        : 0
      const p = String(plan || 'FREE').toUpperCase()
      const limit = isPaidPlan(p)
        ? p === 'ENTERPRISE'
          ? SHODAN_MONTHLY_LIMIT.ENTERPRISE
          : SHODAN_MONTHLY_LIMIT.PRO
        : SHODAN_MONTHLY_LIMIT.FREE
      return {
        title: '調べた企業',
        unit: '件',
        total,
        planLabel,
        meters: [{ label: '今月', used, limit }],
      }
    }

    // AIO requires an authorized organization; /api/usage/aio resolves it explicitly.
    case 'aio': return null

    case 'doyalist': {
      const p = String(plan || 'FREE').toUpperCase()
      const limit =
        p === 'ENTERPRISE'
          ? DOYALIST_PRICING.enterpriseLimit ?? DOYALIST_PRICING.proLimit
          : isPaidPlan(p)
            ? DOYALIST_PRICING.proLimit
            : DOYALIST_PRICING.freeLimit
      return {
        title: '集めた企業',
        unit: '社',
        total: null,
        planLabel,
        meters: [
          { label: '今月', used: await subscriptionUsage(userId, 'doyalist', 'monthly'), limit: norm(limit) },
        ],
      }
    }

    default:
      return null
  }
}
