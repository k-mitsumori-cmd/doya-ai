export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/aishodan/products — 商材一覧
// POST /api/aishodan/products — サービスURLから商材を作成（クロール→チャンク化→プロフィール生成→シナリオ作成）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, orgSlugFrom } from '@/lib/aishodan/access'
import { crawlProductSite, generateProfile, ingestPages } from '@/lib/aishodan/knowledge'
import { DEFAULT_GUARDRAILS, DEFAULT_ICP, DEFAULT_PERSONA, DEFAULT_PHASES, DEFAULT_SLOTS } from '@/lib/aishodan/defaults'
import { assertFreeLimit, FREE_LIMITS } from '@/lib/plan-limit'
import { recordServiceUsage } from '@/lib/service-usage'

// DBスキーマを増やさずに取り込み枠を予約する。公開一覧には出さず、失敗時は削除する。
// 関数の最大実行時間（5分）を超えた予約だけを次回リクエストで整理する。
const PENDING_PRODUCT_NAME = '__doya_aishodan_ingesting_v1__'
const STALE_RESERVATION_MS = 10 * 60 * 1000

async function releaseReservation(productId: string) {
  try {
    await prisma.aishodanProduct.deleteMany({ where: { id: productId, name: PENDING_PRODUCT_NAME } })
  } catch {
    console.error('[aishodan/products] reservation cleanup failed')
  }
}

export async function GET(req: NextRequest) {
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  if (searchParams.has('cursor') && (!cursor || cursor.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const where = { organizationId: ctx.organizationId, name: { not: PENDING_PRODUCT_NAME } }
  if (cursor && !await prisma.aishodanProduct.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const [rows, total] = await Promise.all([prisma.aishodanProduct.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      scenarios: { select: { id: true, name: true }, orderBy: { createdAt: 'asc' } },
      _count: { select: { chunks: true, sources: true } },
    },
    take: 101,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  }), prisma.aishodanProduct.count({ where })])
  const products = rows.slice(0, 100)
  return NextResponse.json({ products, total, nextCursor: rows.length > 100 ? products[99].id : null }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  try {
    await prisma.aishodanProduct.deleteMany({
      where: { organizationId: ctx.organizationId, name: PENDING_PRODUCT_NAME, createdAt: { lt: new Date(Date.now() - STALE_RESERVATION_MS) } },
    })
  } catch {
    console.error('[aishodan/products] stale reservation cleanup failed')
    return NextResponse.json({ error: '商材の取り込み状況を確認できませんでした。再試行してください。' }, { status: 503 })
  }

  const processingMessage = 'この組織では商材を取り込み中です。完了を待ってからもう一度お試しください。'
  if (await prisma.aishodanProduct.findFirst({ where: { organizationId: ctx.organizationId, name: PENDING_PRODUCT_NAME }, select: { id: true } })) {
    return NextResponse.json({ error: processingMessage, code: 'IMPORT_IN_PROGRESS' }, { status: 409 })
  }

  // 無料枠の上限（services.ts の「商材1件」を実際に効かせる）
  // ⚠️ クロール＋LLM生成の前に判定する。後ろに置くと費用だけ発生する。
  const checkQuota = () => assertFreeLimit('aishodanProducts', () =>
    prisma.aishodanProduct.count({ where: { organizationId: ctx.organizationId } })
  )
  const quotaResponse = (checked: Awaited<ReturnType<typeof checkQuota>>) => NextResponse.json({
    error: checked.reason,
    code: 'LIMIT_REACHED',
    ...(checked.limit === FREE_LIMITS.aishodanProducts ? { upgradeUrl: '/aishodan/pricing' } : {}),
  }, { status: 402 })
  const quota = await checkQuota()
  if (!quota.ok) return quotaResponse(quota)

  const body = await req.json().catch(() => ({}))
  const rawUrl = String(body?.url || '').trim()
  if (!rawUrl) return NextResponse.json({ error: 'サービスのURLを入力してください' }, { status: 400 })

  let url: URL
  try {
    url = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`)
  } catch {
    return NextResponse.json({ error: 'URLの形式が正しくありません' }, { status: 400 })
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return NextResponse.json({ error: 'httpsのURLを入力してください' }, { status: 400 })
  }

  let admission: { kind: 'reserved'; id: string } | { kind: 'processing' } | { kind: 'limit' } | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      admission = await prisma.$transaction(async (tx) => {
        const pending = await tx.aishodanProduct.findFirst({
          where: { organizationId: ctx.organizationId, name: PENDING_PRODUCT_NAME },
          select: { id: true },
        })
        if (pending) return { kind: 'processing' } as const
        if (quota.limit !== undefined) {
          const used = await tx.aishodanProduct.count({ where: { organizationId: ctx.organizationId } })
          if (used >= quota.limit) return { kind: 'limit' } as const
        }
        const reserved = await tx.aishodanProduct.create({
          data: { organizationId: ctx.organizationId, name: PENDING_PRODUCT_NAME, sourceUrl: url.toString(), profile: undefined },
          select: { id: true },
        })
        return { kind: 'reserved', id: reserved.id } as const
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
      break
    } catch (error: any) {
      if (error?.code === 'P2034' && attempt < 4) continue
      console.error('[aishodan/products] reservation failed', error?.code || 'unknown')
      return NextResponse.json({ error: '商材の取り込みを開始できませんでした。再試行してください。' }, { status: 503 })
    }
  }
  if (admission?.kind === 'processing') return NextResponse.json({ error: processingMessage, code: 'IMPORT_IN_PROGRESS' }, { status: 409 })
  if (admission?.kind === 'limit') {
    const latestQuota = await checkQuota()
    if (latestQuota.ok) return NextResponse.json({ error: 'プラン情報が更新されました。再読み込みしてからもう一度お試しください。' }, { status: 409 })
    return quotaResponse(latestQuota)
  }
  if (!admission) return NextResponse.json({ error: '商材の取り込みを開始できませんでした。再試行してください。' }, { status: 503 })
  const productId = admission.id

  let pages
  try {
    pages = await crawlProductSite(url.toString())
  } catch (err) {
    console.error('[aishodan] crawl failed', err instanceof Error ? err.message : err)
    await releaseReservation(productId)
    return NextResponse.json({ error: 'サイトを読み取れませんでした。URLをご確認ください。' }, { status: 502 })
  }
  if (pages.length === 0) {
    await releaseReservation(productId)
    return NextResponse.json({ error: 'サイトの内容を読み取れませんでした。URLをご確認ください。' }, { status: 502 })
  }

  let profile
  try {
    profile = await generateProfile(pages)
  } catch (err) {
    console.error('[aishodan] profile failed', err instanceof Error ? err.message : err)
    await releaseReservation(productId)
    return NextResponse.json({ error: '商材情報の生成に失敗しました。時間をおいて再度お試しください。' }, { status: 502 })
  }

  const requestedName = String(body?.name || '').trim() || profile.oneLiner?.slice(0, 60) || pages[0].title || 'サービス'
  const name = requestedName === PENDING_PRODUCT_NAME ? 'サービス' : requestedName.slice(0, 200)
  let chunkCount: number
  let scenarioId: string
  try {
    chunkCount = await ingestPages(productId, pages)

    // シナリオとナレッジが揃うまで公開一覧に出さない。
    const scenario = await prisma.aishodanScenario.create({
      data: {
        productId,
        name: `${name} 一次商談`,
        phases: DEFAULT_PHASES as any,
        slots: DEFAULT_SLOTS as any,
        icp: DEFAULT_ICP as any,
        guardrails: DEFAULT_GUARDRAILS as any,
        persona: DEFAULT_PERSONA as any,
        durationMin: 15,
      },
    })
    scenarioId = scenario.id
    await prisma.aishodanProduct.update({
      where: { id: productId },
      data: { name, profile: profile as any },
    })
  } catch (error: any) {
    console.error('[aishodan/products] save failed', error?.code || 'unknown')
    await releaseReservation(productId)
    return NextResponse.json({ error: '商材情報を保存できませんでした。再試行してください。' }, { status: 503 })
  }

  void recordServiceUsage({
    userId: ctx.userId,
    serviceId: 'aishodan',
    action: '商材を取り込み',
    summary: `${name} / ${url.toString()}`,
    count: chunkCount,
  })

  return NextResponse.json({
    product: { id: productId, name },
    scenarioId,
    pageCount: pages.length,
    chunkCount,
    profile,
  })
}
