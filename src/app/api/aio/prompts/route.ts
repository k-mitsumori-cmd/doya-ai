export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAioContext, hasMinRole, orgSlugFrom } from '@/lib/aio/access'

import { getAioBilling } from '@/lib/aio/billing'
import { isPaidPlan } from '@/lib/unified-plan'

const FREE_PROMPT_LIMIT = 3

// GET /api/aio/prompts — 監視プロンプト一覧
export async function GET(req: NextRequest) {
  const ctx = await getAioContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const prompts = await prisma.aioPrompt.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ prompts }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/aio/prompts — 監視プロンプト追加（manager+）
export async function POST(req: NextRequest) {
  const ctx = await getAioContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  if (!text || text.length > 500 || category.length > 80) {
    return NextResponse.json({ error: 'プロンプトは1〜500文字、分類は80文字以内で入力してください。' }, { status: 400 })
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM aio_organizations WHERE id = ${ctx.organizationId} FOR NO KEY UPDATE`
    const billing = await getAioBilling(tx, ctx.organizationId)
    if (!billing) return { kind: 'billing' } as const
    if (!isPaidPlan(billing.plan)) {
      const count = await tx.aioPrompt.count({ where: { organizationId: ctx.organizationId } })
      if (count >= FREE_PROMPT_LIMIT) return { kind: 'limit' } as const
    }
    const prompt = await tx.aioPrompt.create({
      data: { organizationId: ctx.organizationId, text, category: category || null },
    })
    return { kind: 'created', prompt } as const
  })
  if (result.kind === 'billing') return NextResponse.json({ error: '組織の契約情報を確認できません。組織オーナーにお問い合わせください。', code: 'BILLING_OWNER' }, { status: 409 })
  if (result.kind === 'limit') return NextResponse.json({ error: `無料プランは監視プロンプト${FREE_PROMPT_LIMIT}件までです。組織オーナーのプランをアップグレードしてください。`, code: 'LIMIT', upgradeUrl: '/aio/pricing' }, { status: 402 })
  return NextResponse.json({ ok: true, prompt: result.prompt })
}
