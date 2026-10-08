export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAioBilling } from '@/lib/aio/billing'
import { isPaidPlan } from '@/lib/unified-plan'
import { AIO_FREE_PROMPT_LIMIT } from '@/lib/aio/types'
import { OperationalBodyError, readOperationalJson } from '@/lib/operational-json'
import { beginAioQuickStart, recoverAioQuickStart, finishAioQuickStart, failAioQuickStart, AioStartError } from '@/lib/aio/quick-start-operation'
import { suggestBrandSetup, deriveBrandFromUrl, normalizeUrl } from '@/lib/aio/suggest'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
type Identity = { userId: string; operationId: string }
function response(operation: Awaited<ReturnType<typeof recoverAioQuickStart>>) {
  const quota = operation.code === 'WORKSPACE_LIMIT'
  const error = quota ? '登録できるワークスペースの上限（20件）に達しました。不要なワークスペースを整理してください。'
    : operation.code === 'EXPIRED' ? '開始処理の実行期限を超過しました。保存状況を確認してから、改めて開始してください。'
    : operation.code === 'GENERATION_FAILED' ? '開始処理に失敗しました。入力内容を確認してから、改めて開始してください。' : null
  return NextResponse.json({ ...operation, success: operation.state === 'completed', ...(error ? { error } : {}) }, {
    status: quota ? 402 : operation.code === 'EXPIRED' ? 503 : operation.code === 'GENERATION_FAILED' ? 502
      : ['pending', 'cancelling', 'busy'].includes(operation.state) ? 202 : 200, headers,
  })
}
async function handle(req: NextRequest, method: 'GET' | 'POST' | 'DELETE') {
  let worker: (Identity & { leaseToken: string }) | undefined
  try {
    const session = await getServerSession(authOptions)
    let userId = session?.user?.id
    if (!userId && session?.user?.email) userId = (await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }))?.id
    if (!userId) return NextResponse.json({ error: '認証が必要です' }, { status: 401, headers })
    const body = method === 'GET' ? null : await readOperationalJson(req, 8192)
    const operationId = method === 'GET' ? req.nextUrl.searchParams.get('operationId') : body?.operationId
    if (typeof operationId !== 'string') return NextResponse.json({ error: '画面を更新して保存状況を確認してください。', code: 'OPERATION_REQUIRED' }, { status: 409, headers })
    const identity = { userId, operationId }
    if (method !== 'POST') return response(await recoverAioQuickStart(identity, method === 'DELETE'))
    if (typeof body?.url !== 'string' || body.url.length > 2048) return NextResponse.json({ error: '有効なURLを入力してください' }, { status: 400, headers })
    const url = normalizeUrl(body.url)
    if (!url) return NextResponse.json({ error: '有効なURLを入力してください' }, { status: 400, headers })
    const admission = await beginAioQuickStart({ ...identity, url })
    if (admission.state !== 'started') return response(admission)
    if (!('leaseToken' in admission) || !admission.leaseToken) throw new AioStartError('INVALID_RECEIPT')
    worker = { ...identity, leaseToken: admission.leaseToken }
    const derived = await deriveBrandFromUrl(url)
    const brandName = derived.brandName.trim().slice(0, 120)
    if (!brandName) throw new AioStartError('INVALID_BRAND', 400)
    // A cancellation while site/title derivation ran must not start the next AI stage.
    const current = await recoverAioQuickStart(identity)
    if (current.state === 'cancelling') return response(await failAioQuickStart(worker))
    if (current.state !== 'pending') return response(current)
    const setup = await suggestBrandSetup({ brandName, url })
    const memberName = (session?.user?.name?.trim() || 'オーナー').slice(0, 80)
    const operation = await finishAioQuickStart(worker, async tx => {
      const slug = 'aio-' + createHash('sha256').update(JSON.stringify([userId, operationId])).digest('hex').slice(0, 32)
      const organization = await tx.aioOrganization.create({ data: { name: brandName, slug } })
      await tx.aioMember.create({ data: { organizationId: organization.id, userId, name: memberName, role: 'owner', status: 'ACTIVE', acceptedAt: new Date() } })
      await tx.aioBrandProfile.create({ data: { organizationId: organization.id, brandName, brandUrl: url,
        category: setup.category, ...(setup.aliases.length ? { aliases: setup.aliases } : {}), ...(setup.competitors.length ? { competitors: setup.competitors } : {}) } })
      const billing = await getAioBilling(tx, organization.id)
      if (!billing) throw new Error('Organization billing unavailable')
      const questions = Array.from(new Set(setup.prompts.map(text => text.trim().slice(0, 500)).filter(Boolean)))
      const prompts = isPaidPlan(billing.plan) ? questions : questions.slice(0, AIO_FREE_PROMPT_LIMIT)
      if (prompts.length) await tx.aioPrompt.createMany({ data: prompts.map(text => ({ organizationId: organization.id, text, isActive: true })) })
      return organization
    })
    return response(operation)
  } catch (error) {
    if (worker) {
      try { const operation = await failAioQuickStart(worker); if (operation.state === 'cancelled') return response(operation) }
      catch { console.error('[aio/quick-start] Failure acknowledgement unavailable') }
    }
    if (error instanceof OperationalBodyError) return NextResponse.json({ error: '入力形式またはサイズを確認してください' }, { status: error.status, headers })
    if (error instanceof AioStartError) return NextResponse.json({ error: '開始処理の保存状況を確認してください。', code: error.code }, { status: error.status, headers })
    console.error('[aio/quick-start]')
    return NextResponse.json({ error: '保存状況を確認できません。新しく開始せず、保存状況を確認してください。' }, { status: 500, headers })
  }
}
export const POST = (req: NextRequest) => handle(req, 'POST')
export const GET = (req: NextRequest) => handle(req, 'GET')
export const DELETE = (req: NextRequest) => handle(req, 'DELETE')
