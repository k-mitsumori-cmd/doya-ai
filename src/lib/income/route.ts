// ============================================
// ドヤ収入管理: API ルートの共通処理
// ============================================
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { errorResponse, forbidden, getIncomeContext, hasMinRole, unauthorized, type IncomeContext, type IncomeRole } from './access'

/** ログイン・組織・ロールを確かめてから fn を実行する。業務エラーは 400 系、それ以外は 500 */
export async function withIncome(req: NextRequest, minRole: IncomeRole, fn: (ctx: IncomeContext) => Promise<Response>): Promise<Response> {
  try {
    const ctx = await getIncomeContext(req)
    if (!ctx) {
      // ログイン済みで組織を引けない＝指定した組織の所属が無い・無効化された。ログイン切れとは分ける
      const session = await getServerSession(authOptions)
      return session?.user ? forbidden('この組織を見る権限がありません') : unauthorized()
    }
    if (!hasMinRole(ctx.role, minRole)) return forbidden()
    return await fn(ctx)
  } catch (error) {
    return errorResponse(error)
  }
}

/** Next 15 のルート引数（params は Promise。union にすると next build の型検査で落ちる） */
export type IdCtx = { params: Promise<{ id: string }> }

export async function idFrom(ctx: IdCtx): Promise<string> {
  return (await ctx.params).id
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
