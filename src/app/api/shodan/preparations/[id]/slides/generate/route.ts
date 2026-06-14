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
  // 既存(整列)を引き継ぎ、slidesJson と同じ索引・同じ長さに正規化（未生成は imageUrl:null）
  const existing = (prep.slideImages as unknown as SlideImage[] | null) || []
  const images: SlideImage[] = list.map((s, i) => (existing[i]?.imageUrl ? existing[i] : { title: s.title, imageUrl: existing[i]?.imageUrl ?? null }))

  // 未生成の枠だけをこのリクエストで処理（1回あたり最大BATCH枚）＝300sタイムアウト内に収め、各バッチで保存して作業を失わない
  const todo = images.map((im, i) => (im.imageUrl ? -1 : i)).filter((i) => i >= 0)
  const BATCH = 3
  const batch = todo.slice(0, BATCH)

  if (batch.length > 0) {
    let next = 0
    const concurrency = 2
    async function worker() {
      while (next < batch.length) {
        const i = batch[next++]
        try { images[i] = await generateSlideImage(sctx!.userId, prep!.id, list[i], i) }
        catch (e) { console.error('[shodan/slides] slide failed', (e as any)?.message) }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, worker))
    await prisma.shodanPreparation.update({ where: { id: prep.id }, data: { slideImages: images as any } })
  }

  const successCount = images.filter((x) => x.imageUrl).length
  if (!successCount) return NextResponse.json({ error: 'スライド画像の生成に失敗しました。時間をおいて再度お試しください。' }, { status: 500 })
  return NextResponse.json({ success: true, count: successCount, total: list.length, remaining: list.length - successCount })
}
