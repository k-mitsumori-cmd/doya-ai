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

export async function GET(req: NextRequest) {
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  const products = await prisma.aishodanProduct.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    include: {
      scenarios: { select: { id: true, name: true }, orderBy: { createdAt: 'asc' } },
      _count: { select: { chunks: true, sources: true } },
    },
    take: 100,
  })
  return NextResponse.json({ products })
}

export async function POST(req: NextRequest) {
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

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

  let pages
  try {
    pages = await crawlProductSite(url.toString())
  } catch (err) {
    console.error('[aishodan] crawl failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'サイトを読み取れませんでした。URLをご確認ください。' }, { status: 502 })
  }
  if (pages.length === 0) {
    return NextResponse.json({ error: 'サイトの内容を読み取れませんでした。URLをご確認ください。' }, { status: 502 })
  }

  let profile
  try {
    profile = await generateProfile(pages)
  } catch (err) {
    console.error('[aishodan] profile failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: '商材情報の生成に失敗しました。時間をおいて再度お試しください。' }, { status: 502 })
  }

  const name = String(body?.name || '').trim() || profile.oneLiner?.slice(0, 60) || pages[0].title || 'サービス'

  const product = await prisma.aishodanProduct.create({
    data: {
      organizationId: ctx.organizationId,
      name: name.slice(0, 200),
      sourceUrl: url.toString(),
      profile: profile as any,
    },
  })

  const chunkCount = await ingestPages(product.id, pages)

  // 既定のシナリオを同時に作る。設定を全部埋めないと始められない作りにすると、
  // 誰も最初の商談に到達しない。
  const scenario = await prisma.aishodanScenario.create({
    data: {
      productId: product.id,
      name: `${name} 一次商談`,
      phases: DEFAULT_PHASES as any,
      slots: DEFAULT_SLOTS as any,
      icp: DEFAULT_ICP as any,
      guardrails: DEFAULT_GUARDRAILS as any,
      persona: DEFAULT_PERSONA as any,
      durationMin: 15,
    },
  })

  return NextResponse.json({
    product: { id: product.id, name: product.name },
    scenarioId: scenario.id,
    pageCount: pages.length,
    chunkCount,
    profile,
  })
}
