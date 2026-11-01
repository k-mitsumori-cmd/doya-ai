export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { lockKintaiEmployeeAdmission } from '@/lib/kintai/employee-admission'
import { lockCurrentKintaiManager } from '@/lib/kintai/manager-admission'
import { withKintaiWorkRuleRevision, KintaiWorkRuleRevisionError } from '@/lib/kintai/work-rule-revision'
import { kintaiWorkRuleOperationId, recoverKintaiWorkRuleCreation, cancelKintaiWorkRuleCreation, KintaiWorkRuleOperationError } from '@/lib/kintai/work-rule-operation'
type Ctx = { params: Promise<{ operationId: string }> }
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
async function handle(req: NextRequest, route: Ctx, cancel: boolean) {
 try {
  const ctx = await getKintaiContext()
  if (!ctx) return reply({ error: '認証が必要です' }, 401)
  if (!hasMinRole(ctx.role, 'hr_admin')) return reply({ error: '権限がありません' }, 403)
  const operationId = kintaiWorkRuleOperationId((await route.params).operationId)
  const organizations = new URL(req.url).searchParams.getAll('organizationId')
  if (organizations.length !== 1 || organizations[0] !== ctx.organizationId) return reply({ error: '組織が切り替わっています。最新の画面を開き直してください。' }, 409)
  return await prisma.$transaction(async tx => {
   await lockKintaiEmployeeAdmission(tx, ctx.organizationId)
   if (!(await lockCurrentKintaiManager(tx, ctx))) return reply({ error: '権限がありません' }, 403)
   const find = async (id: string) => { const row = await tx.kintaiWorkRule.findFirst({ where: { id, organizationId: ctx.organizationId } }); return row ? withKintaiWorkRuleRevision(tx, row) : null }
   const result = cancel ? await cancelKintaiWorkRuleCreation(tx, ctx, operationId, find) : await recoverKintaiWorkRuleCreation(tx, ctx, operationId, find)
   return reply({ state: result.state, rule: result.row, operationId, organizationId: ctx.organizationId })
  })
 } catch (e) {
  if (e instanceof KintaiWorkRuleOperationError || e instanceof KintaiWorkRuleRevisionError) return reply({ error: e.message }, e.status)
  console.error('[kintai/work-rules operation]')
  return reply({ error: '保存結果を確認できませんでした。再度、保存結果をご確認ください。' }, 500)
 }
}
export const GET = (req: NextRequest, ctx: Ctx) => handle(req, ctx, false)
export const DELETE = (req: NextRequest, ctx: Ctx) => handle(req, ctx, true)
