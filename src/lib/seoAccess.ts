import { NextRequest, NextResponse } from 'next/server'

export type SeoPlanCode = 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE'

export const SEO_GUEST_COOKIE = 'doyaSeo.guestId'

export function normalizeSeoPlan(raw: any): SeoPlanCode {
  const s = String(raw || '').toUpperCase().trim()
  if (s === 'PRO') return 'PRO'
  if (s === 'ENTERPRISE') return 'ENTERPRISE'
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
  const iso = String(firstLoginAtIso || '').trim()
  if (!iso) return { active: false, remainingMs: 0 }
  const start = Date.parse(iso)
  if (!Number.isFinite(start)) return { active: false, remainingMs: 0 }
  const ends = start + 60 * 60 * 1000 // 1時間
  const now = Date.now()
  const remainingMs = Math.max(0, ends - now)
  return { active: remainingMs > 0, remainingMs }
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
  if (plan === 'PRO') return 30
  if (plan === 'ENTERPRISE') return 200
  if (plan === 'FREE') return 3
  // GUESTは生成不可
  return 0
}

export function seoGuestTotalArticleLimit(): number {
  return 0
}

export function canUseSeoImages(args: { isLoggedIn: boolean; plan: SeoPlanCode; trialActive: boolean }) {
  // 要件: 画像生成（バナー/図解）は PRO 以上から。例外として「初回ログイン後1時間」は使い放題。
  if (args.trialActive) return true
  if (!args.isLoggedIn) return false
  return args.plan === 'PRO' || args.plan === 'ENTERPRISE'
}


