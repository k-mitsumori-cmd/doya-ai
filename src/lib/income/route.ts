// ============================================
// ドヤ収入管理: API ルートの共通処理
// ============================================
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { errorResponse, forbidden, getIncomeContext, hasMinRole, unauthorized, type IncomeContext, type IncomeRole } from './access'
import { authorizeCompanyActionForSession } from '@/lib/company-roles/access.server'
import type { CompanyPermission } from '@/lib/company-roles/permissions'
import { privateApiResponse } from '@/lib/private-api-response'

/**
 * ログイン・組織・ロールを確かめてから fn を実行する。業務エラーは 400 系、それ以外は 500。
 * permission を渡すと、会社の役割の旗の内側で、会社の決まり（契約の金額・請求書の確定など）でも確かめる（ROLES-2026-10-26.md §3.4）
 */
export async function withIncome(req: NextRequest, minRole: IncomeRole, fn: (ctx: IncomeContext) => Promise<Response>, opts: { permission?: CompanyPermission } = {}): Promise<Response> {
  try {
    const ctx = await getIncomeContext(req)
    if (!ctx) {
      // ログイン済みで組織を引けない＝指定した組織の所属が無い・無効化された。ログイン切れとは分ける
      const session = await getServerSession(authOptions)
      return privateApiResponse(session?.user ? forbidden('この組織を見る権限がありません') : unauthorized())
    }
    if (!hasMinRole(ctx.role, minRole)) return privateApiResponse(forbidden())
    if (opts.permission) {
      const company = await authorizeCompanyActionForSession({ userId: ctx.userId, permission: opts.permission, scope: { tool: 'income', organizationId: ctx.organizationId } })
      if (!company.allowed) return privateApiResponse(forbidden('この操作は、会社の決まりで許されていません。会社の管理者に依頼してください。'))
    }
    return privateApiResponse(await fn(ctx))
  } catch (error) {
    return privateApiResponse(errorResponse(error))
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
