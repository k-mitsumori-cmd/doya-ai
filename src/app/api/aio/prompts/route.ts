export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAioContext, hasMinRole, orgSlugFrom } from '@/lib/aio/access'

// 統一プラン：無料は監視プロンプト3件まで
function isPaidPlan(plan?: string | null): boolean {
  const p = (plan || 'FREE').toUpperCase()
  return p !== 'FREE' && p !== 'GUEST'
}
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
  const text = (body.text as string)?.trim()
  if (!text) return NextResponse.json({ error: 'プロンプトを入力してください' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { plan: true } })
  if (!isPaidPlan(user?.plan)) {
    const count = await prisma.aioPrompt.count({ where: { organizationId: ctx.organizationId } })
    if (count >= FREE_PROMPT_LIMIT) {
      return NextResponse.json(
        { error: `無料プランは監視プロンプト${FREE_PROMPT_LIMIT}件までです。プロプランで無制限になります。`, code: 'LIMIT' },
        { status: 402 }
      )
    }
  }

  const prompt = await prisma.aioPrompt.create({
    data: {
      organizationId: ctx.organizationId,
      text: text.slice(0, 500),
      category: (body.category as string)?.trim()?.slice(0, 80) || null,
    },
  })
  return NextResponse.json({ ok: true, prompt })
}
