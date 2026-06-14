export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShodanContext, orgSlugFrom } from '@/lib/shodan/access'
import { generateSlideImage, type SlideImage } from '@/lib/shodan/slide-image'
import type { ProposalSlide } from '@/lib/shodan/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// POST /api/shodan/preparations/[id]/slides/generate — 提案スライドを画像として一括生成
export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const prep = await prisma.shodanPreparation.findFirst({ where: { id: p.id, organizationId: sctx.organizationId } })
  if (!prep) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  const slides = (prep.slidesJson as unknown as ProposalSlide[] | null) || []
  if (!slides.length) return NextResponse.json({ error: '先に提案資料の構成を生成してください' }, { status: 400 })

  const list = slides.slice(0, 8)
  const results: (SlideImage | null)[] = new Array(list.length).fill(null)
  let next = 0
  const concurrency = 2
  async function worker() {
    while (next < list.length) {
      const i = next++
      try { results[i] = await generateSlideImage(sctx!.userId, prep!.id, list[i], i) }
      catch (e) { console.error('[shodan/slides] slide failed', (e as any)?.message) }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker))

  const images = results.filter((x): x is SlideImage => !!x)
  if (!images.length) return NextResponse.json({ error: 'スライド画像の生成に失敗しました。時間をおいて再度お試しください。' }, { status: 500 })

  await prisma.shodanPreparation.update({ where: { id: prep.id }, data: { slideImages: images as any } })
  return NextResponse.json({ success: true, count: images.length })
}
