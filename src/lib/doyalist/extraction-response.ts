import { NextResponse } from 'next/server'
import { readDoyalistExtractionResult } from './extraction-operation'
import { streamDoyalistJsonArray } from './stream-json'

/** GET recovery and POST acknowledgement use the same bounded, private result contract. */
export async function doyalistOperationResponse(
  identity: { userId: string; operationId: string },
  quotaAction: { upgradeUrl?: string; contactUrl?: string } = {},
) {
  const { operation, companies } = await readDoyalistExtractionResult(identity)
  const fields = { operationId: operation.operationId, projectId: operation.projectId, state: operation.state, count: operation.count }
  if (operation.state === 'completed') {
    const response = streamDoyalistJsonArray({ ...fields, success: true, generated: companies.length,
      ...(operation.warning ? { warning: operation.warning } : {}) }, 'companies', companies)
    response.headers.set('Vary', 'Cookie')
    return response
  }
  const quota = operation.code === 'MONTHLY_LIMIT_REACHED' || operation.code === 'MONTHLY_REQUEST_EXCEEDS_REMAINING'
  return NextResponse.json({ ...fields, success: false, generated: 0,
    ...(operation.code ? { code: operation.code } : {}), ...(quota ? quotaAction : {}),
  }, { status: quota ? 403 : operation.code === 'no_hits' ? 422 : operation.code === 'api_error' ? 502 : operation.code === 'collection_timeout' ? 503 : operation.state === 'pending' || operation.state === 'cancelling' ? 202 : 200,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}
