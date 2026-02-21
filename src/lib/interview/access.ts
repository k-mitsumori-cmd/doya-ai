// ============================================
// ドヤインタビュー — 認証・認可ヘルパー
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { InterviewPlanCode } from './types'

export const INTERVIEW_GUEST_COOKIE = 'doyaInterview.guestId'

/**
 * セッションからユーザー情報を取得
 */
export async function getInterviewUser(): Promise<{
  userId: string | null
  plan: InterviewPlanCode
  firstLoginAt: string | null
}> {
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null
  const userId = String(user?.id || '').trim() || null

  let plan: InterviewPlanCode = 'FREE'
  if (user?.interviewPlan) {
    plan = normalizePlan(user.interviewPlan)
  } else if (user?.plan) {
    plan = normalizePlan(user.plan)
  }

  return {
    userId,
    plan,
    firstLoginAt: user?.firstLoginAt || null,
  }
}

/**
 * リクエストからゲストIDを取得
 */
export function getGuestIdFromRequest(req: NextRequest): string | null {
  const v = req.cookies.get(INTERVIEW_GUEST_COOKIE)?.value
  return v && v.trim() ? v.trim() : null
}

/**
 * ゲストIDを生成
 */
export function ensureGuestId(): string {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

/**
 * レスポンスにゲストCookieをセット
 */
export function setGuestCookie(res: NextResponse, guestId: string): void {
  res.cookies.set(INTERVIEW_GUEST_COOKIE, guestId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}

/**
 * プランコードの正規化
 */
export function normalizePlan(raw: any): InterviewPlanCode {
  const s = String(raw || '').toUpperCase().trim()
  if (s === 'PRO') return 'PRO'
  if (s === 'ENTERPRISE') return 'ENTERPRISE'
  if (s === 'FREE') return 'FREE'
  return 'GUEST'
}

/**
 * 1時間トライアルが有効か判定
 */
export function isTrialActive(firstLoginAtIso: string | null | undefined): boolean {
  const iso = String(firstLoginAtIso || '').trim()
  if (!iso) return false
  const start = Date.parse(iso)
  if (!Number.isFinite(start)) return false
  return Date.now() < start + 60 * 60 * 1000
}

/**
 * 日次利用上限（プロジェクト作成数/日）
 * -1 = 無制限
 */
export function interviewDailyLimit(plan: InterviewPlanCode): number {
  switch (plan) {
    case 'ENTERPRISE': return -1
    case 'PRO':        return 30
    case 'FREE':       return 5
    case 'GUEST':      return 3
    default:           return 3
  }
}

/**
 * ゲスト累計利用上限（総プロジェクト数）
 */
export function interviewGuestTotalLimit(): number {
  return 3
}

/**
 * リソースの所有者チェック
 * 成功 → null / 失敗 → エラーレスポンス
 */
export function checkOwnership(
  resource: { userId?: string | null; guestId?: string | null },
  currentUserId: string | null,
  currentGuestId: string | null
): NextResponse | null {
  if (currentUserId) {
    if (String(resource.userId || '') !== currentUserId) {
      return NextResponse.json(
        { success: false, error: '見つかりませんでした' },
        { status: 404 }
      )
    }
  } else if (currentGuestId) {
    if (String(resource.guestId || '') !== currentGuestId) {
      return NextResponse.json(
        { success: false, error: '見つかりませんでした' },
        { status: 404 }
      )
    }
  } else {
    return NextResponse.json(
      { success: false, error: '認証が必要です' },
      { status: 401 }
    )
  }
  return null
}

/**
 * DATABASE_URL が未設定の場合にエラーレスポンスを返すガード
 * 設定されていれば null を返す
 */
export function requireDatabase(): NextResponse | null {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        success: false,
        error: 'データベース未接続: .env.local に DATABASE_URL を設定してください',
        code: 'NO_DATABASE',
      },
      { status: 503 }
    )
  }
  return null
}

/**
 * JST基準の日次範囲 (既存のseoAccessと同じロジック)
 */
export function jstDayRange(now = new Date()): { start: Date; end: Date } {
  const ms = now.getTime()
  const jst = new Date(ms + 9 * 60 * 60 * 1000)
  const startJst = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), 0, 0, 0))
  const endJst = new Date(startJst.getTime() + 24 * 60 * 60 * 1000)
  return {
    start: new Date(startJst.getTime() - 9 * 60 * 60 * 1000),
    end: new Date(endJst.getTime() - 9 * 60 * 60 * 1000),
  }
}
