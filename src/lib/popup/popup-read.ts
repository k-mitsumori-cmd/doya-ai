// ============================================
// ドヤポップアップ: 読み取り（集計）の正本
// ============================================
// 統合仕様（ADDON-SERVICES-2026-10-18）R-4: 画面の集計はここに置き、
//   - API route（/api/popup/*）
//   - サーバコンポーネントの初期表示（/popup/*）
//   - ホームのカード（集客の数字 7 日）
//   - エージェントの道具（popup.stats）
// の全経路が同じ関数を呼ぶ。
// ⚠️ DB は引数で受ける（単体テストで偽のDBを渡せるように。既定は呼び出し側の prisma）。
// ⚠️ 必ず userId で絞る。他人のサイト・案は null を返す（存在するかどうかも漏らさない）。
import type { PrismaClient } from '@prisma/client'
import type { SiteProfile } from '@/lib/asklink/types'
import { ctr, jstDay } from './schema'
import { embedCode, toPopupDto, toSiteDto, type PopupDto, type SiteDto } from './dto'
import { emptyTotals, sinceDay, sumTotals, ymd, type DailyPoint, type StatTotals } from './stats'

export type PopupDb = Pick<PrismaClient, 'popupSite' | 'popup' | 'popupStat'>

/** 案ごとの合計。now 指定時は JST の当日まで（day は @db.Date の日付バケット）。 */
export async function totalsByPopup(db: PopupDb, popupIds: string[], days: number, now?: Date): Promise<Map<string, StatTotals>> {
  const out = new Map<string, StatTotals>()
  if (popupIds.length === 0) return out
  const rows = await db.popupStat.groupBy({
    by: ['popupId'],
    where: { popupId: { in: popupIds }, day: { gte: sinceDay(days, now), ...(now ? { lte: jstDay(now) } : {}) } },
    _sum: { impressions: true, clicks: true, closes: true },
  })
  for (const r of rows) {
    const impressions = r._sum.impressions || 0
    const clicks = r._sum.clicks || 0
    out.set(r.popupId, { impressions, clicks, closes: r._sum.closes || 0, ctr: ctr(clicks, impressions) })
  }
  return out
}

/** サイト一覧（削除していないもの）と、直近30日の集計 */
export async function listSites(db: PopupDb, userId: string): Promise<SiteDto[]> {
  const sites = await db.popupSite.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { popups: { select: { id: true, status: true } } },
  })
  const totals = await totalsByPopup(db, sites.flatMap((s) => s.popups.map((p) => p.id)), 30)
  return sites.map((s) =>
    toSiteDto(s, {
      liveCount: s.popups.filter((p) => p.status === 'live').length,
      totals: sumTotals(s.popups.map((p) => totals.get(p.id)).filter((t): t is StatTotals => !!t)),
    })
  )
}

export interface SiteDetail {
  days: number
  site: SiteDto
  popups: PopupDto[]
}

/** サイト詳細（案と期間の集計）。自分のサイトでなければ null */
export async function getSiteDetail(db: PopupDb, userId: string, siteId: string, days: number): Promise<SiteDetail | null> {
  const site = await db.popupSite.findFirst({
    where: { id: siteId, userId, deletedAt: null },
    include: { popups: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
  })
  if (!site) return null
  const totals = await totalsByPopup(db, site.popups.map((p) => p.id), days)
  const popups = site.popups.map((p) => toPopupDto(p, totals.get(p.id)))
  return {
    days,
    site: toSiteDto(site, { liveCount: popups.filter((p) => p.status === 'live').length, totals: sumTotals(popups.map((p) => p.totals)) }),
    popups,
  }
}

export interface EditSiteInfo {
  id: string
  name: string
  domain: string
  sourceUrl: string
  embedCode: string
  lastSeenAt: string | null
  colors: string[]
  /** リンクの候補（サイトで実際に見つかったURLだけ） */
  pages: { label: string; url: string }[]
  allowedUrls: string[]
}

/** 編集画面の初期データ。自分の案でなければ null */
export async function getPopupForEdit(db: PopupDb, userId: string, popupId: string): Promise<{ popup: PopupDto; site: EditSiteInfo } | null> {
  const popup = await db.popup.findFirst({ where: { id: popupId, userId, site: { deletedAt: null } }, include: { site: true } })
  if (!popup) return null
  const profile = popup.site.site as unknown as Partial<SiteProfile> | null
  const allowedUrls = Array.isArray(popup.site.allowedUrls) ? (popup.site.allowedUrls as unknown[]).filter((u): u is string => typeof u === 'string') : []
  return {
    popup: toPopupDto(popup),
    site: {
      id: popup.site.id,
      name: popup.site.name,
      domain: popup.site.domain,
      sourceUrl: popup.site.sourceUrl,
      embedCode: embedCode(popup.site.siteKey),
      lastSeenAt: popup.site.lastSeenAt?.toISOString() ?? null,
      colors: Array.isArray(profile?.colors) ? profile!.colors : [],
      pages: [
        ...(profile?.contactUrl ? [{ label: 'お問い合わせ・相談', url: profile.contactUrl }] : []),
        ...(profile?.downloadUrl ? [{ label: '資料ダウンロード', url: profile.downloadUrl }] : []),
        ...(profile?.pricingUrl ? [{ label: '料金', url: profile.pricingUrl }] : []),
        ...(Array.isArray(profile?.pages) ? profile!.pages : []),
      ],
      allowedUrls,
    },
  }
}

export interface PopupDaily {
  days: number
  series: DailyPoint[]
  byTarget: Record<string, number>
  totals: StatTotals
}

/** 1つの案の日別推移（データの無い日も0で埋める）とリンク別クリック数。自分の案でなければ null */
export async function getPopupDaily(db: PopupDb, userId: string, popupId: string, days: number, now = new Date()): Promise<PopupDaily | null> {
  const popup = await db.popup.findFirst({ where: { id: popupId, userId, site: { deletedAt: null } }, select: { id: true } })
  if (!popup) return null
  const since = sinceDay(days, now)
  const rows = await db.popupStat.findMany({
    where: { popupId: popup.id, day: { gte: since } },
    select: { day: true, target: true, impressions: true, clicks: true, closes: true },
  })
  const map = new Map<string, DailyPoint>()
  for (let i = 0; i < days; i++) {
    const d = new Date(since)
    d.setUTCDate(d.getUTCDate() + i)
    map.set(ymd(d), { day: ymd(d), impressions: 0, clicks: 0, closes: 0 })
  }
  const byTarget: Record<string, number> = {}
  for (const r of rows) {
    const p = map.get(ymd(r.day))
    if (p) {
      p.impressions += r.impressions
      p.clicks += r.clicks
      p.closes += r.closes
    }
    if (r.clicks) byTarget[r.target] = (byTarget[r.target] || 0) + r.clicks
  }
  const series = [...map.values()]
  return { days, series, byTarget, totals: sumTotals(series.map((p) => ({ ...p, ctr: null }))) }
}

export interface PopupSummary {
  days: number
  /** 期間内の表示・クリック・閉じた数とクリック率 */
  totals: StatTotals
  /** 公開中の案の数 */
  liveCount: number
  /** 登録しているサイトの数 */
  siteCount: number
  /** 期間内で表示の多い案（最大3件） */
  top: { popupId: string; siteId: string; name: string; siteName: string; impressions: number; clicks: number; ctr: number | null }[]
}

/**
 * ホームの「集客の数字（7日）」とエージェントの道具 popup.stats の正本。
 * サイトが1つも無ければ siteCount=0（ホームはカードを出さない。空のカードを出さない）。
 */
export async function getPopupSummary(db: PopupDb, userId: string, days = 7, now: Date = new Date()): Promise<PopupSummary> {
  const popups = await db.popup.findMany({
    where: { userId, site: { deletedAt: null } },
    select: { id: true, name: true, status: true, siteId: true, site: { select: { name: true } } },
  })
  const siteCount = await db.popupSite.count({ where: { userId, deletedAt: null } })
  const totals = await totalsByPopup(db, popups.map((p) => p.id), days, now)
  const top = popups
    .map((p) => {
      const t = totals.get(p.id) || emptyTotals()
      return { popupId: p.id, siteId: p.siteId, name: p.name, siteName: p.site.name, impressions: t.impressions, clicks: t.clicks, ctr: t.ctr }
    })
    .filter((p) => p.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 3)
  return {
    days,
    totals: sumTotals([...totals.values()]),
    liveCount: popups.filter((p) => p.status === 'live').length,
    siteCount,
    top,
  }
}
