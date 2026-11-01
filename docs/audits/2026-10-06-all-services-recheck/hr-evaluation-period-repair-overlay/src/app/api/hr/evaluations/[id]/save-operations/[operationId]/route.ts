export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { privateApiJson } from '@/lib/private-api-response'
import { runHrEvaluationMutation } from '@/lib/hr/evaluation-mutation'
import { HrEvaluationAiAccessError } from '@/lib/hr/evaluation-ai-access'
import { validHrEvaluationSaveOperationId, readHrEvaluationSaveOperation, endHrEvaluationSaveOperation, HrEvaluationSaveOperationConflict } from '@/lib/hr/evaluation-save-operation'
type Ctx = { params: Promise<{ id: string; operationId: string }> }
async function handle(req: NextRequest, ctx: Ctx, method: 'GET' | 'DELETE') {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as { id?: string } | undefined)?.id) return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    const hrCtx = await getHrContext()
    if (!hrCtx) return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    if (req.headers.get('X-HR-Organization-Id') !== hrCtx.organizationId) return privateApiJson({ error: '保存対象の組織を確認してください。' }, { status: 403 })
    const { id, operationId } = await ctx.params
    if (!id || !validHrEvaluationSaveOperationId(operationId)) return privateApiJson({ error: '保存操作の情報を確認してください。' }, { status: 400 })
    const result = await runHrEvaluationMutation(prisma, hrCtx, tx => method === 'GET' ? readHrEvaluationSaveOperation(tx, hrCtx, operationId, id) : endHrEvaluationSaveOperation(tx, hrCtx, operationId, id))
    return result.allowed ? privateApiJson({ success: true, operationId, organizationId: hrCtx.organizationId, evaluationId: id, ...result.value }) : privateApiJson({ error: '保存結果を確認する権限が変更されています。' }, { status: 403 })
  } catch (error: unknown) {
    if (error instanceof HrEvaluationSaveOperationConflict) return privateApiJson({ error: '保存操作の情報が一致しません。' }, { status: 409 })
    if (error instanceof HrEvaluationAiAccessError) return privateApiJson({ error: error.message }, { status: error.status })
    return privateApiJson({ error: '保存結果を確認できませんでした。同じ操作の記録を再確認してください。' }, { status: 500 })
  }
}
export const GET = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'GET')
export const DELETE = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'DELETE')
