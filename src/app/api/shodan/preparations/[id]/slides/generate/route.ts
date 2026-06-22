export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShodanContext, orgSlugFrom } from '@/lib/shodan/access'
import { generateSlideImage, type StoredSlide, type SlideBrand } from '@/lib/shodan/slide-image'
import { signedUrl } from '@/lib/shodan/storage'
import { raceTimeout } from '@/lib/fetch-timeout'
import type { ProposalSlide } from '@/lib/shodan/types'
import { isPaidPlan } from '@/lib/unified-plan'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// POST /api/shodan/preparations/[id]/slides/generate — 提案スライドを画像として一括生成
export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  // スライド資料の生成はプロプラン限定
  const user = await prisma.user.findUnique({ where: { id: sctx.userId }, select: { plan: true } })
  if (!isPaidPlan(user?.plan)) {
    return NextResponse.json(
      { error: 'スライド資料の生成はプロプランの機能です。プロプランにアップグレードするとご利用いただけます。', code: 'PLAN' },
      { status: 402 }
    )
  }

  const prep = await prisma.shodanPreparation.findFirst({ where: { id: p.id, organizationId: sctx.organizationId } })
  if (!prep) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  const slides = (prep.slidesJson as unknown as ProposalSlide[] | null) || []
  if (!slides.length) return NextResponse.json({ error: '先に提案資料の構成を生成してください' }, { status: 400 })

  const list = slides.slice(0, 8)
  // 既存(整列)を引き継ぎ、slidesJson と同じ索引・同じ長さに正規化（未生成は imagePath:null）
  const existing = (prep.slideImages as unknown as StoredSlide[] | null) || []
  const images: StoredSlide[] = list.map((s, i) => (existing[i]?.imagePath ? existing[i] : { title: s.title, imagePath: existing[i]?.imagePath ?? null }))

  // 未生成の枠だけをこのリクエストで処理（1回あたり最大BATCH枚）＝300sタイムアウト内に収め、各バッチで保存して作業を失わない
  // 自社情報のブランドカラー・ロゴをスライドに反映（その会社に合った資料に）
  const profile = await prisma.shodanCompanyProfile.findUnique({ where: { organizationId: sctx.organizationId } })
  const brand: SlideBrand = {
    brandColors: (profile?.brandColors as string[] | null) || undefined,
    logoUrl: profile?.logoPath ? await signedUrl(profile.logoPath) : null,
  }

  const todo = images.map((im, i) => (im.imagePath ? -1 : i)).filter((i) => i >= 0)
  // 1リクエスト最大2枚を並列生成。クライアントは remaining が尽きるまで再呼び出しして全枚数を埋める。
  // 旧実装は「2枚並列＋各150sハードタイムアウト」だったが、gpt-image-2 high・1536x1024 は並列時に実測123〜145秒かかるため、
  // 生成成功の目前で外側150sタイムアウトが先に発火→スライドが白いまま＆フォールバックも効かない事象が出ていた。
  // 外側タイムアウトを実レイテンシに十分なマージン(220s)へ引き上げ、maxDuration=300s内に2枚並列が確実に収まるようにする。
  const BATCH = 2
  const batch = todo.slice(0, BATCH)

  if (batch.length > 0) {
    let next = 0
    const concurrency = 2
    async function worker() {
      while (next < batch.length) {
        const i = batch[next++]
        try { images[i] = await raceTimeout('slideGen', 220000, generateSlideImage(sctx!.userId, prep!.id, list[i], i, { brand })) }
        catch (e) { console.error('[shodan/slides] slide failed', (e as any)?.message) }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, worker))

    // 書き込み前に最新を再取得してマージ（別タブ等の同時実行で、先に成功した枠をnullで上書きしない）
    const fresh = await prisma.shodanPreparation.findUnique({ where: { id: prep.id }, select: { slideImages: true } })
    const latest = (fresh?.slideImages as unknown as StoredSlide[] | null) || []
    const merged: StoredSlide[] = images.map((im, i) => (im.imagePath ? im : latest[i]?.imagePath ? latest[i] : im))
    await prisma.shodanPreparation.update({ where: { id: prep.id }, data: { slideImages: merged as any } })
    images.splice(0, images.length, ...merged)
  }

  const successCount = images.filter((x) => x.imagePath).length
  if (!successCount) return NextResponse.json({ error: 'スライド画像の生成に失敗しました。時間をおいて再度お試しください。' }, { status: 500 })
  return NextResponse.json({ success: true, count: successCount, total: list.length, remaining: list.length - successCount })
}
