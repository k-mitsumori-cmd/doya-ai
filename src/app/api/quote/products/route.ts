export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/quote/products — 商材一覧
// POST /api/quote/products — 商材を登録（URL解析つき）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuoteContext, orgSlugFrom } from '@/lib/quote/access'
import { FREE_LIMITS, jstStartOfMonthUtc } from '@/lib/plan-limit'
import { getOrganizationQuotaUsage, recordOrganizationQuotaUsage } from '@/lib/organization-quota-ledger'
import { isPaidPlan } from '@/lib/unified-plan'
import { isQuoteProductProfile } from '@/lib/quote/response-shape'

async function retryProductTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit() }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error
      if (attempt === 2) throw new Error('商材の同時登録を完了できませんでした')
    }
  }
  throw new Error('商材を登録できませんでした')
}

export async function GET(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  if (searchParams.has('cursor') && (!cursor || cursor.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const where = { organizationId: ctx.organizationId }
  if (cursor && !await prisma.quoteProduct.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const [rows, total] = await Promise.all([
    prisma.quoteProduct.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 101,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.quoteProduct.count({ where }),
  ])
  const products = rows.slice(0, 100)
  return NextResponse.json({
    products,
    total,
    nextCursor: rows.length > 100 ? products[products.length - 1].id : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: '商材名を入力してください' }, { status: 400 })
  }
  if (body.sourceUrl != null && typeof body.sourceUrl !== 'string') {
    return NextResponse.json({ error: '商材URLの形式が正しくありません' }, { status: 400 })
  }
  if (body.profile != null && !isQuoteProductProfile(body.profile)) {
    return NextResponse.json({ error: '商材情報の形式が正しくありません' }, { status: 400 })
  }
  const name = body.name.trim()
  if (name.length > 200) return NextResponse.json({ error: '商材名は200文字以内で入力してください' }, { status: 400 })
  const sourceUrl = body.sourceUrl?.trim() || null
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl)
      if (sourceUrl.length > 2048 || !['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error()
    } catch {
      return NextResponse.json({ error: '商材URLは認証情報を含まない2048文字以内のHTTP(S) URLで入力してください' }, { status: 400 })
    }
  }
  const profile = body.profile ?? null
  const outcome = await retryProductTransaction(() => prisma.$transaction(async tx => {
    const actor = await tx.quoteMember.findFirst({
      where: { organizationId: ctx.organizationId, userId: ctx.userId, status: 'ACTIVE' },
      select: { id: true, role: true },
    })
    if (!actor) return { kind: 'forbidden' as const }
    const owner = await tx.quoteMember.findFirst({
      where: { organizationId: ctx.organizationId, status: 'ACTIVE', role: 'owner', userId: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    })
    const ownerPlan = owner?.userId ? await tx.user.findUnique({ where: { id: owner.userId }, select: { plan: true } }) : null
    const now = new Date()
    const usedLifetime = await getOrganizationQuotaUsage(tx, 'quoteProducts', ctx.organizationId, 'lifetime', () =>
      tx.quoteProduct.count({ where: { organizationId: ctx.organizationId } }), now)
    const canManageBilling = ctx.userId === owner?.userId && actor.role === 'owner'
    if (!isPaidPlan(ownerPlan?.plan) && usedLifetime >= FREE_LIMITS.quoteProducts) {
      return { kind: 'limit' as const, used: usedLifetime, canManageBilling }
    }
    const usedMonthly = await getOrganizationQuotaUsage(tx, 'quoteProducts', ctx.organizationId, 'monthly', () =>
      tx.quoteProduct.count({ where: { organizationId: ctx.organizationId, createdAt: { gte: jstStartOfMonthUtc(now) } } }), now)
    const product = await tx.quoteProduct.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        sourceUrl,
        profile: profile as any,
      },
    })
    await recordOrganizationQuotaUsage(tx, 'quoteProducts', ctx.organizationId, usedLifetime, usedMonthly, now)
    return { kind: 'created' as const, product }
  }, { isolationLevel: 'Serializable' }))
  if (outcome.kind === 'forbidden') return NextResponse.json({ error: '組織へのアクセス権がありません。再読み込みしてください' }, { status: 403 })
  if (outcome.kind === 'limit') return NextResponse.json({
    error: outcome.canManageBilling
      ? `無料プランで登録できる商材は${FREE_LIMITS.quoteProducts}件までです。プランをご確認ください。`
      : `この組織で登録できる商材は${FREE_LIMITS.quoteProducts}件までです。利用枠の変更は組織の契約者にご相談ください。`,
    code: 'LIMIT_REACHED',
    used: outcome.used,
    limit: FREE_LIMITS.quoteProducts,
    canManageBilling: outcome.canManageBilling,
    ...(outcome.canManageBilling ? { upgradeUrl: '/quote/pricing' } : {}),
  }, { status: 402 })
  return NextResponse.json({ product: outcome.product })
}
