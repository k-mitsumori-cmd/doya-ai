// ============================================
// 年間レポートの読み込み（DB を読むだけ）
// ============================================
// ⚠️ 書き込まない。組織を作らない（各ツールの getOrCreate… は呼ばない）。
// ⚠️ 読むのは、本人（userId はいつもセッションから）が作ったものと、本人が ACTIVE で入っている会社（組織）の分だけ。
//    組織の id はリクエストから受け取らない。会社の選び方は「本人がオーナーの組織 → 古い順」（見積・AI商談の既定と同じ）。
// ⚠️ 顧客名・金額・社員名は、利用者が選び、その組織で本人が owner・admin のときだけ読む。選んでいなければ DB から取らない。
// ⚠️ 1つのツールが読めなくても、ほかのツールは出す（そのツールは 0 件）。失敗の中身はログに出さない。
import { yearRange, type AnnualRawData, type AnnualToolId, type RevealKey } from './report'
import { excludeIds } from '@/lib/system-watch/marked-records'
import { systemWatchRecordIdsBetween } from '@/lib/system-watch/marked-records-range'

/** 会社（組織）ごとに数えるツールと、その所属の表 */
export const ORG_MEMBER_MODELS = {
  quote: 'quoteMember',
  shodan: 'shodanMember',
  mensetsu: 'mensetsuMember',
  aishodan: 'aishodanMember',
  sfa: 'sfaMember',
} as const

export type OrgToolId = keyof typeof ORG_MEMBER_MODELS

const ADMIN_ROLES = ['owner', 'admin']
/** 1つのツールから読む記録の上限（1年分の件数として十分な数） */
export const EVENTS_CAP = 20_000

export interface AnnualAccess {
  orgs: Partial<Record<OrgToolId, { organizationId: string; role: string }>>
  /** 顧客名・金額・社員名の出どころ（見積・営業管理・商談準備）のどれかで、本人が owner・admin か */
  isOrgAdmin: boolean
}

type Db = any

/** 本人の会社（ツールごとに1つ）。userId と ACTIVE で絞るので、ほかの会社は決して選ばれない */
export async function resolveAnnualAccess(db: Db, userId: string): Promise<AnnualAccess> {
  const orgs: AnnualAccess['orgs'] = {}
  await Promise.all(
    (Object.entries(ORG_MEMBER_MODELS) as [OrgToolId, string][]).map(async ([tool, model]) => {
      try {
        const members = db[model]
        const select = { organizationId: true, role: true }
        const row =
          (await members.findFirst({ where: { userId, status: 'ACTIVE', role: 'owner' }, orderBy: { createdAt: 'asc' }, select })) ??
          (await members.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, select }))
        if (row && typeof row.organizationId === 'string') orgs[tool] = { organizationId: row.organizationId, role: String(row.role ?? '') }
      } catch {
        // このツールの表が読めないときは、そのツールの会社は無いものとする
      }
    })
  )
  const isOrgAdmin = (['quote', 'sfa', 'shodan'] as const).some((t) => orgs[t] && ADMIN_ROLES.includes(orgs[t]!.role))
  return { orgs, isOrgAdmin }
}

const dates = (rows: { createdAt?: Date; wonAt?: Date | null }[]) =>
  rows.map((r) => r.wonAt ?? r.createdAt).filter((d): d is Date => d instanceof Date)

const num = (v: unknown) => {
  const n = typeof v === 'bigint' ? Number(v) : Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

export async function loadAnnualRawData(
  db: Db,
  input: { userId: string; year: number; access: AnnualAccess; reveal: readonly RevealKey[]; companyName: string | null }
): Promise<AnnualRawData> {
  const { userId, year, access, reveal } = input
  const { start, end } = yearRange(year)
  const createdAt = { gte: start, lt: end }
  const listOpts = { select: { createdAt: true }, take: EVENTS_CAP }
  const org = (t: OrgToolId) => access.orgs[t]?.organizationId
  /** 顧客名・金額・社員名を読んでよい組織（本人が owner・admin のときだけ） */
  const adminOrg = (t: OrgToolId) => (access.orgs[t] && ADMIN_ROLES.includes(access.orgs[t]!.role) ? access.orgs[t]!.organizationId : undefined)

  const queries: [AnnualToolId, () => Promise<Date[]>][] = [
    ['banner', async () => dates(await db.generation.findMany({ where: { userId, serviceId: 'banner', createdAt }, ...listOpts }))],
    ['seo', async () => dates(await db.seoArticle.findMany({ where: { userId, status: 'DONE', createdAt }, ...listOpts }))],
    ['adimage', async () => dates(await db.adImageCreative.findMany({ where: { concept: { campaign: { userId } }, createdAt }, ...listOpts }))],
    ['asklink', async () => dates(await db.askLinkRun.findMany({ where: { userId, createdAt }, ...listOpts }))],
    ['popup', async () => dates(await db.popupSite.findMany({ where: { userId, createdAt }, ...listOpts }))],
    ['shanai', async () => dates(await db.shanaiUsageLog.findMany({ where: { userId, kind: 'article', createdAt }, ...listOpts }))],
    ['doyaslide', async () => dates(await db.doyaSlideProject.findMany({ where: { userId, status: 'completed', createdAt }, ...listOpts }))],
    ['interview', async () => dates(await db.interviewProject.findMany({ where: { userId, createdAt }, ...listOpts }))],
  ]
  const q = org('quote')
  // 自動点検（system-watch の B1）が毎日作る見積の下書きは数えない（2026-10-26 ユーザー決定。記録の ID で外す）
  if (q) queries.push(['quote', async () => {
    const watch = await systemWatchRecordIdsBetween(db, 'quote-document', [q], start, end).catch(() => [])
    return dates(await db.quoteDocument.findMany({ where: { organizationId: q, createdAt, ...excludeIds(watch) }, ...listOpts }))
  }])
  const s = org('shodan')
  if (s) queries.push(['shodan', async () => dates(await db.shodanPreparation.findMany({ where: { organizationId: s, status: 'done', createdAt }, ...listOpts }))])
  const m = org('mensetsu')
  if (m) queries.push(['mensetsu', async () => dates(await db.mensetsuSession.findMany({ where: { organizationId: m, status: { in: ['completed', 'evaluated'] }, createdAt }, ...listOpts }))])
  const a = org('aishodan')
  if (a) queries.push(['aishodan', async () => dates(await db.aishodanSession.findMany({ where: { organizationId: a, room: { isPreview: false }, status: { in: ['completed', 'evaluated'] }, createdAt }, ...listOpts }))])
  const f = org('sfa')
  if (f) queries.push(['sfa', async () => dates(await db.sfaDeal.findMany({ where: { organizationId: f, status: 'won', wonAt: createdAt }, select: { wonAt: true }, take: EVENTS_CAP }))])

  const settled = await Promise.allSettled(queries.map(([, run]) => run()))
  const events: AnnualRawData['events'] = {}
  settled.forEach((r, i) => {
    events[queries[i][0]] = r.status === 'fulfilled' ? r.value : []
  })

  const raw: AnnualRawData = { companyName: reveal.includes('company') ? input.companyName : null, events }
  const qa = adminOrg('quote')
  const fa = adminOrg('sfa')
  const sa = adminOrg('shodan')
  const sentQuotes = (orgId: string) => ({ organizationId: orgId, status: { in: ['confirmed', 'sent'] }, createdAt })
  const wonDeals = (orgId: string) => ({ organizationId: orgId, status: 'won', wonAt: createdAt })

  if (reveal.includes('amounts') && (qa || fa)) {
    const [quoted, won] = await Promise.all([
      qa ? db.quoteDocument.aggregate({ where: sentQuotes(qa), _sum: { totalExclTax: true } }).then((r: any) => num(r?._sum?.totalExclTax)).catch(() => 0) : 0,
      fa ? db.sfaDeal.aggregate({ where: wonDeals(fa), _sum: { amount: true } }).then((r: any) => num(r?._sum?.amount)).catch(() => 0) : 0,
    ])
    raw.amounts = { quoted, won }
  }

  if (reveal.includes('customers') && (qa || fa || sa)) {
    const parts = await Promise.all([
      qa ? db.quoteDocument.findMany({ where: sentQuotes(qa), select: { clientCompany: true }, take: EVENTS_CAP }).then((rows: any[]) => rows.map((r) => r.clientCompany)).catch(() => []) : [],
      fa ? sfaNames(db, fa, 'accountId', 'sfaAccount', wonDeals(fa)).catch(() => []) : [],
      sa ? db.shodanPreparation.findMany({ where: { organizationId: sa, status: 'done', createdAt }, select: { targetName: true }, take: EVENTS_CAP }).then((rows: any[]) => rows.map((r) => r.targetName)).catch(() => []) : [],
    ])
    raw.customers = parts.flat()
  }

  if (reveal.includes('members') && (fa || sa)) {
    const parts = await Promise.all([
      fa ? sfaNames(db, fa, 'assigneeMemberId', 'sfaMember', wonDeals(fa)).catch(() => []) : [],
      sa ? memberNames(db, 'shodanMember', sa, db.shodanPreparation.findMany({ where: { organizationId: sa, status: 'done', createdAt }, select: { createdByMemberId: true }, take: EVENTS_CAP }), 'createdByMemberId').catch(() => []) : [],
    ])
    raw.members = parts.flat()
  }

  return raw
}

/** 受注した商談の取引先・担当者の名前（記録1件ごとに1つ）。名前は同じ組織の中だけで引く */
async function sfaNames(db: Db, orgId: string, field: 'accountId' | 'assigneeMemberId', model: 'sfaAccount' | 'sfaMember', where: object): Promise<string[]> {
  return memberNames(db, model, orgId, db.sfaDeal.findMany({ where, select: { [field]: true }, take: EVENTS_CAP }), field)
}

async function memberNames(db: Db, model: string, orgId: string, rowsP: Promise<Record<string, unknown>[]>, field: string): Promise<string[]> {
  const rows = await rowsP
  const ids = [...new Set(rows.map((r) => r[field]).filter((v): v is string => typeof v === 'string'))]
  if (!ids.length) return []
  const named: { id: string; name: string | null }[] = await db[model].findMany({ where: { organizationId: orgId, id: { in: ids } }, select: { id: true, name: true } })
  const byId = new Map(named.map((n) => [n.id, n.name]))
  return rows.map((r) => byId.get(r[field] as string)).filter((v): v is string => typeof v === 'string')
}
