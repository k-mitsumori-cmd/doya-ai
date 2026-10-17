// ============================================
// ドヤ収入管理: API ルートの共通処理
// ============================================
import type { NextRequest } from 'next/server'
import { errorResponse, forbidden, getIncomeContext, hasMinRole, unauthorized, type IncomeContext, type IncomeRole } from './access'

/** ログイン・組織・ロールを確かめてから fn を実行する。業務エラーは 400 系、それ以外は 500 */
export async function withIncome(req: NextRequest, minRole: IncomeRole, fn: (ctx: IncomeContext) => Promise<Response>): Promise<Response> {
  try {
    const ctx = await getIncomeContext(req)
    if (!ctx) return unauthorized()
    if (!hasMinRole(ctx.role, minRole)) return forbidden()
    return await fn(ctx)
  } catch (error) {
    return errorResponse(error)
  }
}

export type IdCtx = { params: Promise<{ id: string }> | { id: string } }

export async function idFrom(ctx: IdCtx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
