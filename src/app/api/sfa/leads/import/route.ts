export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { leadImportInput, createLeadImport, findLeadImport } from '@/lib/sfa/lead-import'
import { lockSfaMutationActor, SfaMutationError } from '@/lib/sfa/mutation-authority'
import { recoverSfaCreation, cancelSfaCreation, sfaOperationId } from '@/lib/sfa/creation-receipt'
import { withSfaAdmission } from '@/lib/sfa/limits'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
const fail = (error: unknown) => json({ error: error instanceof SfaMutationError ? error.message : '取込結果を確認できませんでした。一覧をご確認ください。' }, error instanceof SfaMutationError ? error.status : 500)

export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です' }, 401)
  try {
    const input = leadImportInput(await req.json().catch(() => null))
    const operationId = sfaOperationId(input.body.operationId)
    const admitted = await withSfaAdmission(ctx.organizationId, {}, async tx => {
      await lockSfaMutationActor(tx, ctx)
      return createLeadImport(tx, ctx, operationId, input)
    })
    if (admitted.limit) throw new Error('Unexpected lead import admission limit')
    return json({ ok: true, ...admitted.created })
  } catch (error) { return fail(error) }
}
async function recover(req: NextRequest, cancel: boolean) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です' }, 401)
  try {
    const operations = new URL(req.url).searchParams.getAll('operationId')
    if (operations.length !== 1) throw new SfaMutationError(400, '操作情報を指定してください。')
    const operationId = sfaOperationId(operations[0])!
    const result = await prisma.$transaction(async tx => {
      await lockSfaMutationActor(tx, ctx)
      const find = (id: string) => findLeadImport(tx, ctx, id)
      return cancel ? cancelSfaCreation(tx, ctx, 'lead-import', operationId, find) : recoverSfaCreation(tx, ctx, 'lead-import', operationId, find)
    })
    return json({ state: result.state, import: result.row })
  } catch (error) { return fail(error) }
}
export async function GET(req: NextRequest) { return recover(req, false) }
// Cancels only a not-yet-committed import receipt; never deletes an imported lead.
export async function DELETE(req: NextRequest) { return recover(req, true) }
