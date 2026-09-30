import { NextRequest, NextResponse } from 'next/server'
import { getFreeHourRemainingMs, isWithinFreeHour } from '@/lib/pricing'

export type SeoPlanCode = 'GUEST' | 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE'

export const SEO_GUEST_COOKIE = 'doyaSeo.guestId'

export function normalizeSeoPlan(raw: any): SeoPlanCode {
  const s = String(raw || '').toUpperCase().trim()
  if (s === 'PRO') return 'PRO'
  if (s === 'ENTERPRISE') return 'ENTERPRISE'
  if (s === 'LIGHT') return 'LIGHT'
  if (s === 'FREE') return 'FREE'
  return 'GUEST'
}

export function getGuestIdFromRequest(req: NextRequest): string | null {
  const v = req.cookies.get(SEO_GUEST_COOKIE)?.value
  return v && v.trim() ? v.trim() : null
}

export function ensureGuestId(): string {
  // nodejs runtime: crypto.randomUUID() が利用可能
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function setGuestCookie(res: NextResponse, guestId: string) {
  res.cookies.set(SEO_GUEST_COOKIE, guestId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1年
  })
}

export function isTrialActive(firstLoginAtIso: string | null | undefined): { active: boolean; remainingMs: number } {
  // 全サービス共通の廃止済み判定を使う。SEOだけ無料の無制限枠を復活させない。
  return { active: isWithinFreeHour(firstLoginAtIso), remainingMs: getFreeHourRemainingMs(firstLoginAtIso) }
}

export function jstDayRange(now = new Date()): { start: Date; end: Date } {
  // JST基準で日次上限を切る（ユーザー体験重視）
  const ms = now.getTime()
  const jst = new Date(ms + 9 * 60 * 60 * 1000)
  const startJst = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), 0, 0, 0))
  const endJst = new Date(startJst.getTime() + 24 * 60 * 60 * 1000)
  // UTCに戻す
  return {
    start: new Date(startJst.getTime() - 9 * 60 * 60 * 1000),
    end: new Date(endJst.getTime() - 9 * 60 * 60 * 1000),
  }
}

export function jstMonthRange(now = new Date()): { start: Date; end: Date } {
  // JST基準で月初〜月末の範囲を返す
  const ms = now.getTime()
  const jst = new Date(ms + 9 * 60 * 60 * 1000)
  const startJst = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1, 0, 0, 0))
  const endJst = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() + 1, 1, 0, 0, 0))
  return {
    start: new Date(startJst.getTime() - 9 * 60 * 60 * 1000),
    end: new Date(endJst.getTime() - 9 * 60 * 60 * 1000),
  }
}

/** @deprecated 後方互換用。新コードでは seoMonthlyArticleLimit を使うこと */
export function seoDailyArticleLimit(plan: SeoPlanCode): number {
  return seoMonthlyArticleLimit(plan)
}

export function seoMonthlyArticleLimit(plan: SeoPlanCode): number {
  // -1 = 無制限
  if (plan === 'ENTERPRISE') return 200
  if (plan === 'PRO') return 30
  if (plan === 'LIGHT') return 10
  if (plan === 'FREE') return 3
  // GUESTは生成不可
  return 0
}

export function seoGuestTotalArticleLimit(): number {
  return 0
}

export function canUseSeoImages(args: { isLoggedIn: boolean; plan: SeoPlanCode; trialActive: boolean }) {
  // 画像生成（バナー/図解）はLIGHT以上から。1時間無料特典は共通判定で廃止済み。
  // 外部画像APIの運用上限は seo-tool-admission 側で別途適用する。
  if (args.trialActive) return true
  if (!args.isLoggedIn) return false
  return args.plan === 'LIGHT' || args.plan === 'PRO' || args.plan === 'ENTERPRISE'
}
