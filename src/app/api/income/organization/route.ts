export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { IncomeError, audit } from '@/lib/income/access'
import { canReadPromaneWorkspace, listLinkablePromaneWorkspaces } from '@/lib/income/expense-source'
import { asBody, reqStr, str } from '@/lib/income/parse'
import { readJson, withIncome } from '@/lib/income/route'

export async function GET(req: NextRequest) {
  return withIncome(req, 'member', async (ctx) => {
    const [org, issuer, workspaces] = await Promise.all([
      prisma.incomeOrganization.findFirst({ where: { id: ctx.organizationId }, select: { id: true, name: true, slug: true, promaneWorkspaceId: true } }),
      prisma.incomeIssuer.findUnique({ where: { organizationId: ctx.organizationId } }),
      listLinkablePromaneWorkspaces(ctx.userId),
    ])
    return NextResponse.json({ organization: org, role: ctx.role, issuerReady: !!issuer?.companyName, promaneWorkspaces: workspaces })
  })
}

export async function PATCH(req: NextRequest) {
  return withIncome(req, 'admin', async (ctx) => {
    const body = asBody(await readJson(req))
    const data: { name?: string; promaneWorkspaceId?: string | null } = {}
    if ('name' in body) data.name = reqStr(body, 'name', '組織名', 80)
    if ('promaneWorkspaceId' in body) {
      const wsId = str(body, 'promaneWorkspaceId', '支出の取り込み元', { max: 64 })
      // 他社のプロマネを結べないように、自分が財務を見られるワークスペースだけ
      if (wsId && !(await canReadPromaneWorkspace(ctx.userId, wsId))) throw new IncomeError('そのワークスペースの経費を見る権限がありません', 403)
      data.promaneWorkspaceId = wsId
    }
    const org = await prisma.incomeOrganization.update({ where: { id: ctx.organizationId }, data, select: { id: true, name: true, slug: true, promaneWorkspaceId: true } })
    await audit(prisma, ctx, 'organization.update', 'organization', ctx.organizationId, data)
    return NextResponse.json({ organization: org })
  })
}
