export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { IncomeError, audit } from '@/lib/income/access'
import { EXPENSE_ADAPTERS, canReadPromaneWorkspace, listLinkablePromaneWorkspaces, type ExpenseSourceId } from '@/lib/income/expense-source'
import { asBody, reqStr, str } from '@/lib/income/parse'
import { readJson, withIncome } from '@/lib/income/route'
import { withIncomeWrite } from '@/lib/income/route'
import { readableExpenseOrganization } from '@/lib/expense/income-source'

const ORG_SELECT = { id: true, name: true, slug: true, promaneWorkspaceId: true, expenseSourceId: true, expenseOrganizationId: true } as const

export async function GET(req: NextRequest) {
  return withIncome(req, 'member', async (ctx) => {
    const [org, issuer, workspaces] = await Promise.all([
      prisma.incomeOrganization.findFirst({ where: { id: ctx.organizationId }, select: ORG_SELECT }),
      prisma.incomeIssuer.findUnique({ where: { organizationId: ctx.organizationId } }),
      listLinkablePromaneWorkspaces(ctx.userId),
    ])
    // 取り込み元の候補（expense は支出管理のマージ後に available になる）
    const expenseSources = await Promise.all(
      (['promane', 'expense'] as ExpenseSourceId[]).map(async (id) => {
        const a = EXPENSE_ADAPTERS[id]
        return a ? { id, label: a.label, note: a.note, available: true, options: await a.listLinkable(ctx.userId) } : { id, label: 'ドヤ支出管理', note: '準備中です', available: false, options: [] }
      }),
    )
    return NextResponse.json({ organization: org, role: ctx.role, issuerReady: !!issuer?.companyName, promaneWorkspaces: workspaces, expenseSources })
  })
}

export async function PATCH(req: NextRequest) {
  return withIncomeWrite(req, 'admin', async () => {
    const body = asBody(await readJson(req))
    const data: { name?: string; promaneWorkspaceId?: string | null; expenseSourceId?: string | null; expenseOrganizationId?: string | null } = {}
    if ('name' in body) data.name = reqStr(body, 'name', '組織名', 80)
    // 旧形式: { promaneWorkspaceId } … プロマネを取り込み元にする（null で解除）
    if ('promaneWorkspaceId' in body) {
      const wsId = str(body, 'promaneWorkspaceId', '支出の取り込み元', { max: 64 })
      // 他社のプロマネを結べないように、自分が財務を見られるワークスペースだけ
      Object.assign(data, { promaneWorkspaceId: wsId, expenseSourceId: wsId ? 'promane' : null, expenseOrganizationId: null })
    }
    // 新形式: { expenseSourceId, expenseRefId } … 取り込み元は 1 つだけ（両方は足さない）
    if ('expenseSourceId' in body) {
      const sourceId = str(body, 'expenseSourceId', '支出の取り込み元', { max: 20 })
      const refId = str(body, 'expenseRefId', '支出の取り込み先', { max: 64 })
      if (!sourceId) Object.assign(data, { expenseSourceId: null, promaneWorkspaceId: null, expenseOrganizationId: null })
      else {
        const adapter = (sourceId === 'promane' || sourceId === 'expense') ? EXPENSE_ADAPTERS[sourceId] : undefined
        if (!adapter) throw new IncomeError('その取り込み元はまだ使えません')
        if (!refId) throw new IncomeError('その取り込み先を見る権限がありません', 403)
        Object.assign(data, sourceId === 'promane'
          ? { expenseSourceId: 'promane', promaneWorkspaceId: refId, expenseOrganizationId: null }
          : { expenseSourceId: 'expense', expenseOrganizationId: refId, promaneWorkspaceId: null })
      }
    }
    return data
  }, async (ctx, tx, data) => {
    if (data.promaneWorkspaceId && !(await canReadPromaneWorkspace(ctx.userId, data.promaneWorkspaceId, tx))) throw new IncomeError('そのワークスペースの経費を見る権限がありません', 403)
    if (data.expenseOrganizationId && !(await readableExpenseOrganization(ctx.userId, data.expenseOrganizationId, tx))) throw new IncomeError('その取り込み先を見る権限がありません', 403)
    const org = await tx.incomeOrganization.update({ where: { id: ctx.organizationId }, data, select: ORG_SELECT })
    await audit(tx, ctx, 'organization.update', 'organization', ctx.organizationId, data)
    return NextResponse.json({ organization: org })
  })
}
