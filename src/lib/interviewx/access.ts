// ============================================
// ドヤインタビューAI-X — 認証・認可ヘルパー
// ============================================

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { InterviewXPlanCode } from './types'

/**
 * セッションからユーザー情報を取得
 */
export async function getInterviewXUser(): Promise<{
  userId: string | null
  plan: InterviewXPlanCode
  firstLoginAt: string | null
}> {
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null
  const userId = String(user?.id || '').trim() || null

  let plan: InterviewXPlanCode = 'FREE'
  if (user?.plan) {
    plan = normalizePlan(user.plan)
  }

  return {
    userId,
    plan,
    firstLoginAt: user?.firstLoginAt || null,
  }
}

/**
 * プランコードの正規化
 */
export function normalizePlan(raw: any): InterviewXPlanCode {
  const s = String(raw || '').toUpperCase().trim()
  if (s === 'PRO') return 'PRO'
  if (s === 'ENTERPRISE') return 'ENTERPRISE'
  if (s === 'LIGHT') return 'LIGHT'
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
 * 月次利用上限（プロジェクト作成数/月）
 */
export function interviewXMonthlyLimit(plan: InterviewXPlanCode): number {
  switch (plan) {
    case 'ENTERPRISE': return -1
    case 'PRO':        return 30
    case 'LIGHT':      return 10
    case 'FREE':       return 3
    case 'GUEST':      return 0
    default:           return 0
  }
}

/**
 * 認証ガード — userId必須
 */
export function requireAuth(userId: string | null): NextResponse | null {
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'ログインが必要です' },
      { status: 401 }
    )
  }
  return null
}

/**
 * リソースの所有者チェック
 */
export function checkOwnership(
  resource: { userId?: string | null },
  currentUserId: string | null,
): NextResponse | null {
  if (!currentUserId) {
    return NextResponse.json(
      { success: false, error: '認証が必要です' },
      { status: 401 }
    )
  }
  if (String(resource.userId || '') !== currentUserId) {
    return NextResponse.json(
      { success: false, error: '見つかりませんでした' },
      { status: 404 }
    )
  }
  return null
}

/**
 * DATABASE_URL が未設定の場合にエラーレスポンスを返すガード
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
