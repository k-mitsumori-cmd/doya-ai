export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { OperationalBodyError, readOperationalJson } from '@/lib/operational-json'
import { MAX_DOYALIST_PROJECT_BODY_BYTES } from '@/lib/doyalist/project-input'
import { prepareDoyalistExtraction, recoverDoyalistExtraction, DoyalistExtractionError } from '@/lib/doyalist/extraction-operation'
import { doyalistOperationResponse } from '@/lib/doyalist/extraction-response'
import { getUserDoyalistLimits } from '@/lib/doyalist/limits'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
async function handle(req: NextRequest, method: 'GET' | 'POST' | 'DELETE') {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401, headers })
    const body = method === 'GET' ? null : await readOperationalJson(req, MAX_DOYALIST_PROJECT_BODY_BYTES + 1024)
    const operationId = method === 'GET' ? req.nextUrl.searchParams.get('operationId') : body?.operationId
    if (typeof operationId !== 'string') return NextResponse.json({ error: '操作IDを確認してください' }, { status: 400, headers })
    const identity = { userId, operationId }
    if (method === 'POST') {
      if (typeof body?.count !== 'number' || (body.project !== undefined && (!body.project || typeof body.project !== 'object' || Array.isArray(body.project))) ||
          (body.projectId !== undefined && typeof body.projectId !== 'string')) return NextResponse.json({ error: '入力形式を確認してください' }, { status: 400, headers })
      const operation = await prepareDoyalistExtraction({ ...identity, count: body.count, project: body.project as Record<string, unknown> | undefined, projectId: body.projectId as string | undefined })
      return NextResponse.json({ success: true, operation }, { headers })
    }
    if (method === 'DELETE') await recoverDoyalistExtraction(identity, true)
    const limits = await getUserDoyalistLimits(userId)
    return await doyalistOperationResponse(identity, limits.tier === 'FREE' || limits.tier === 'GUEST'
      ? { upgradeUrl: '/doyalist/pricing' } : { contactUrl: 'https://doyamarke.surisuta.jp/contact' })
  } catch (error) {
    if (error instanceof DoyalistExtractionError) return NextResponse.json({ error: '抽出の保存状況を確認できません。新しく抽出せず、保存結果を確認してください。', code: error.code }, { status: error.status, headers })
    if (error instanceof OperationalBodyError) return NextResponse.json({ error: '入力形式またはサイズを確認してください' }, { status: error.status, headers })
    console.error('[doyalist/operations] Operation acknowledgement failed')
    return NextResponse.json({ error: '保存状況を確認できません。新しく抽出せず、再度保存状況を確認してください。' }, { status: 500, headers })
  }
}
export const GET = (req: NextRequest) => handle(req, 'GET')
export const POST = (req: NextRequest) => handle(req, 'POST')
export const DELETE = (req: NextRequest) => handle(req, 'DELETE')
