// ============================================
// ドヤポップアップ: 計測（日別集計）
// ============================================
// ⚠️ 生ログは持たない。popup_stat (popupId, day, target) に加算する。
// ⚠️ 加算は INSERT ... ON CONFLICT DO UPDATE の1文で行う。読んでから書く形にすると、
//    同時の表示で数え漏れる（read-modify-write の競合）。
// ⚠️ 読み取り（集計）は popup-read.ts。ここは書き込みと、集計の小さな計算だけ。
import { prisma } from '@/lib/prisma'
import { ctr, jstDay, type TrackEvent } from './schema'

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function incrementStat(popupId: string, event: TrackEvent, target: string, now = new Date()): Promise<void> {
  const day = ymd(jstDay(now))
  const imp = event === 'impression' ? 1 : 0
  const clk = event === 'click' ? 1 : 0
  const cls = event === 'close' ? 1 : 0
  await prisma.$executeRaw`
    INSERT INTO "popup_stat" ("popupId", "day", "target", "impressions", "clicks", "closes")
    VALUES (${popupId}, ${day}::date, ${target}, ${imp}, ${clk}, ${cls})
    ON CONFLICT ("popupId", "day", "target") DO UPDATE SET
      "impressions" = "popup_stat"."impressions" + EXCLUDED."impressions",
      "clicks" = "popup_stat"."clicks" + EXCLUDED."clicks",
      "closes" = "popup_stat"."closes" + EXCLUDED."closes"`
}

export interface StatTotals {
  impressions: number
  clicks: number
  closes: number
  /** クリック率（％）。表示0なら null */
  ctr: number | null
}

export function emptyTotals(): StatTotals {
  return { impressions: 0, clicks: 0, closes: 0, ctr: null }
}

/** 集計の開始日（JST で今日を含めて days 日分） */
export function sinceDay(days: number, now = new Date()): Date {
  const d = jstDay(now)
  d.setUTCDate(d.getUTCDate() - (days - 1))
  return d
}

export function parseDays(v: string | null): 7 | 30 | 90 {
  return v === '7' ? 7 : v === '90' ? 90 : 30
}

export function sumTotals(list: StatTotals[]): StatTotals {
  const impressions = list.reduce((a, t) => a + t.impressions, 0)
  const clicks = list.reduce((a, t) => a + t.clicks, 0)
  const closes = list.reduce((a, t) => a + t.closes, 0)
  return { impressions, clicks, closes, ctr: ctr(clicks, impressions) }
}

export interface DailyPoint {
  /** YYYY-MM-DD（JST） */
  day: string
  impressions: number
  clicks: number
  closes: number
}
