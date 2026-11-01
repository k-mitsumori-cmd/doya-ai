export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { privateApiJson } from '@/lib/private-api-response'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { runHrDepartmentMutation } from '@/lib/hr/department-mutation'
import { validDepartmentOperationId, readDepartmentCreationReceipt, cancelDepartmentCreation } from '@/lib/hr/department-operation'

async function operationRequest(request: Request, cancel: boolean) {
  try {
    const ctx = await getHrContext()
    if (!ctx) return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    if (!hasMinRole(ctx.role, 'ADMIN')) return privateApiJson({ error: '権限がありません' }, { status: 403 })
    const query = new URL(request.url).searchParams
    const operationId = query.get('operationId'), organizationId = query.get('organizationId')
    if (query.getAll('operationId').length !== 1 || query.getAll('organizationId').length !== 1 ||
      !validDepartmentOperationId(operationId) || !organizationId || [...query.keys()].some(k => k !== 'operationId' && k !== 'organizationId')) {
      return privateApiJson({ error: '部署作成の操作情報をご確認ください' }, { status: 400 })
    }
    if (organizationId !== ctx.organizationId) return privateApiJson({ error: '組織が変更されています。元の組織で作成結果を確認してください。' }, { status: 403 })
    const result = await runHrDepartmentMutation(ctx, tx => cancel
      ? cancelDepartmentCreation(tx, ctx, operationId)
      : readDepartmentCreationReceipt(tx, ctx, operationId))
    if (!result.allowed) return privateApiJson({ error: '権限がありません' }, { status: 403 })
    return privateApiJson({ success: true, operationId, organizationId, ...result.value })
  } catch {
    console.error('[hr/department-operation] unexpected error')
    return privateApiJson({ error: '部署の作成結果を確認できませんでした。しばらくしてからもう一度お試しください。' }, { status: 500 })
  }
}

export async function GET(request: Request) { return operationRequest(request, false) }
export async function DELETE(request: Request) { return operationRequest(request, true) }
