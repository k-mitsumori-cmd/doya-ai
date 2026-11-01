import { privateApiJson } from '@/lib/private-api-response'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { IncomeError, audit } from '@/lib/income/access'
import { EXPENSE_ADAPTERS, canReadPromaneWorkspace, listLinkablePromaneWorkspaces, type ExpenseSourceId } from '@/lib/income/expense-source'
import { asBody, reqStr, str } from '@/lib/income/parse'
import { readJson, withIncome } from '@/lib/income/route'

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
    return privateApiJson({ organization: org, role: ctx.role, issuerReady: !!issuer?.companyName, promaneWorkspaces: workspaces, expenseSources })
  })
}

export async function PATCH(req: NextRequest) {
  return withIncome(req, 'admin', async (ctx) => {
    const body = asBody(await readJson(req))
    const data: { name?: string; promaneWorkspaceId?: string | null; expenseSourceId?: string | null; expenseOrganizationId?: string | null } = {}
    if ('name' in body) data.name = reqStr(body, 'name', '組織名', 80)
    // 旧形式: { promaneWorkspaceId } … プロマネを取り込み元にする（null で解除）
    if ('promaneWorkspaceId' in body) {
      const wsId = str(body, 'promaneWorkspaceId', '支出の取り込み元', { max: 64 })
      // 他社のプロマネを結べないように、自分が財務を見られるワークスペースだけ
      if (wsId && !(await canReadPromaneWorkspace(ctx.userId, wsId))) throw new IncomeError('そのワークスペースの経費を見る権限がありません', 403)
      Object.assign(data, { promaneWorkspaceId: wsId, expenseSourceId: wsId ? 'promane' : null, expenseOrganizationId: null })
    }
    // 新形式: { expenseSourceId, expenseRefId } … 取り込み元は 1 つだけ（両方は足さない）
    if ('expenseSourceId' in body) {
      const sourceId = str(body, 'expenseSourceId', '支出の取り込み元', { max: 20 })
      const refId = str(body, 'expenseRefId', '支出の取り込み先', { max: 64 })
      if (!sourceId) Object.assign(data, { expenseSourceId: null, promaneWorkspaceId: null, expenseOrganizationId: null })
      else {
        const adapter = EXPENSE_ADAPTERS[sourceId as ExpenseSourceId]
        if (!adapter) throw new IncomeError('その取り込み元はまだ使えません')
        if (!refId || !(await adapter.canRead(ctx.userId, refId))) throw new IncomeError('その取り込み先を見る権限がありません', 403)
        Object.assign(data, sourceId === 'promane'
          ? { expenseSourceId: 'promane', promaneWorkspaceId: refId, expenseOrganizationId: null }
          : { expenseSourceId: 'expense', expenseOrganizationId: refId, promaneWorkspaceId: null })
      }
    }
    const org = await prisma.incomeOrganization.update({ where: { id: ctx.organizationId }, data, select: ORG_SELECT })
    await audit(prisma, ctx, 'organization.update', 'organization', ctx.organizationId, data)
    return privateApiJson({ organization: org })
  })
}
