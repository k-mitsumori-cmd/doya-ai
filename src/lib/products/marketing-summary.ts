// ============================================
// マーケティングのホーム（/hub/marketing）に出す数字を読む（段3）
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md §4.3・§7（段3）
// - 経営ホームの集計（src/lib/home/summary.ts）にはマーケティングの数字が無いので、ここで別に読む。経営ホームの集計は変えない。
// - 読むのは、本人が今月つくったバナー・SEO記事・ペルソナの数と、AI検索での見え方（最後に参加した AIO の組織の最新の調べ）。
// ⚠️ 読むだけ。DB に書かない。AIO の組織は作らない（access.ts の解決と同じ条件の findFirst を使う）。
// ⚠️ 1つのツールが読めなくても、ほかの欄とホーム全体は落とさない（Promise.allSettled で個別に握る）。
import { prisma } from '@/lib/prisma'
import { jstStartOfMonthUtc } from '@/lib/usage-summary'
import { ROLE_HIERARCHY as AIO_ROLES } from '@/lib/aio/types'
import { ceilToolRole } from '@/lib/company-roles/access.server'
import type { HomeToolState } from '@/lib/home/summary'

export interface MarketingCount {
  state: HomeToolState
  href: string
  thisMonth: number
  total: number
}

export interface MarketingSummary {
  banner: MarketingCount
  seo: MarketingCount & { doneThisMonth: number }
  persona: MarketingCount
  aio: {
    state: HomeToolState
    href: string
    /** 最新の調べの、AI の回答で自社に触れた割合（0〜100） */
    awarenessPct: number | null
    /** 最新の調べの、追っているブランドの中での自社の割合（0〜100） */
    shareOfVoice: number | null
    /** 最新の調べの日時（ISO） */
    scannedAt: string | null
    scansThisMonth: number
  }
}

const countState = (total: number): HomeToolState => (total > 0 ? 'ready' : 'empty')

async function loadBanner(userId: string, monthStart: Date) {
  const [thisMonth, total] = await Promise.all([
    prisma.generation.count({ where: { userId, serviceId: 'banner', createdAt: { gte: monthStart } } }),
    prisma.generation.count({ where: { userId, serviceId: 'banner' } }),
  ])
  return { thisMonth, total }
}

async function loadSeo(userId: string, monthStart: Date) {
  const [thisMonth, doneThisMonth, total] = await Promise.all([
    prisma.seoArticle.count({ where: { userId, createdAt: { gte: monthStart } } }),
    prisma.seoArticle.count({ where: { userId, status: 'DONE', createdAt: { gte: monthStart } } }),
    prisma.seoArticle.count({ where: { userId } }),
  ])
  return { thisMonth, doneThisMonth, total }
}

async function loadPersona(userId: string, monthStart: Date) {
  const [thisMonth, total] = await Promise.all([
    prisma.personaProject.count({ where: { userId, status: 'succeeded', createdAt: { gte: monthStart } } }),
    prisma.personaProject.count({ where: { userId, status: 'succeeded' } }),
  ])
  return { thisMonth, total }
}

// AIO: 最後に参加した組織（aio/access.ts の getAioContext と同じ）。組織が無い・会社の役割の上限で見られないなら null
async function loadAio(userId: string, monthStart: Date) {
  const membership = await prisma.aioMember.findFirst({
    where: { userId, status: 'ACTIVE', role: { in: Object.keys(AIO_ROLES) } },
    orderBy: { createdAt: 'desc' },
    select: { organizationId: true, role: true },
  })
  if (!membership) return null
  // 会社の役割の旗の内側では、会社の役割の上限を当てる（ツールの画面で見られない人には、ここでも出さない）
  const role = await ceilToolRole({ tool: 'aio', userId, organizationId: membership.organizationId, toolRole: membership.role })
  if (!role) return null
  const [latest, scansThisMonth] = await Promise.all([
    prisma.aioScan.findFirst({
      where: { organizationId: membership.organizationId, status: 'done' },
      orderBy: { createdAt: 'desc' },
      select: { awarenessPct: true, shareOfVoice: true, createdAt: true },
    }),
    prisma.aioScan.count({ where: { organizationId: membership.organizationId, status: { in: ['done', 'deleted'] }, createdAt: { gte: monthStart } } }),
  ])
  return { latest, scansThisMonth }
}

export async function getMarketingSummary(userId: string): Promise<MarketingSummary> {
  const monthStart = jstStartOfMonthUtc()
  const [bannerR, seoR, personaR, aioR] = await Promise.allSettled([
    loadBanner(userId, monthStart),
    loadSeo(userId, monthStart),
    loadPersona(userId, monthStart),
    loadAio(userId, monthStart),
  ])
  const count = (r: PromiseSettledResult<{ thisMonth: number; total: number }>, href: string): MarketingCount =>
    r.status === 'fulfilled'
      ? { state: countState(r.value.total), href, thisMonth: r.value.thisMonth, total: r.value.total }
      : { state: 'error', href, thisMonth: 0, total: 0 }
  const seo = count(seoR, '/seo')
  const aio = aioR.status === 'fulfilled' ? aioR.value : undefined
  return {
    banner: count(bannerR, '/banner'),
    seo: { ...seo, doneThisMonth: seoR.status === 'fulfilled' ? seoR.value.doneThisMonth : 0 },
    persona: count(personaR, '/persona'),
    aio: {
      state: aioR.status === 'rejected' ? 'error' : aio?.latest ? 'ready' : 'empty',
      href: '/aio',
      awarenessPct: aio?.latest?.awarenessPct ?? null,
      shareOfVoice: aio?.latest?.shareOfVoice ?? null,
      scannedAt: aio?.latest?.createdAt.toISOString() ?? null,
      scansThisMonth: aio?.scansThisMonth ?? 0,
    },
  }
}
