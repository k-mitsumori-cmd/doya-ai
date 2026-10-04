export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { saveSlideImages, SlideImageConflict } from '@/lib/shodan/save-slide-images'
import { getShodanContext, orgSlugFrom } from '@/lib/shodan/access'
import { generateSlideImage, type StoredSlide, type SlideBrand } from '@/lib/shodan/slide-image'
import { signedUrl } from '@/lib/shodan/storage'
import { raceTimeout } from '@/lib/fetch-timeout'
import type { ProposalSlide } from '@/lib/shodan/types'
import { isPaidPlan } from '@/lib/unified-plan'
import { getShodanBilling } from '@/lib/shodan/billing'
import { claimShodanSlideLease, releaseShodanSlideLease, ShodanSlideGenerationInProgressError } from '@/lib/shodan/slide-generation-lease'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/shodan/preparations/[id]/slides/generate — 提案スライドを画像として一括生成
export async function POST(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  // スライド資料の生成はプロプラン限定
  const billing = await getShodanBilling(prisma, sctx.organizationId)
  if (!billing) return NextResponse.json({ error: '組織の契約情報を確認できませんでした。時間をおいて再度お試しください。' }, { status: 503 })
  if (!isPaidPlan(billing.plan)) {
    const canManageBilling = sctx.role === 'owner' && sctx.userId === billing.ownerUserId
    return NextResponse.json(
      { error: canManageBilling ? 'スライド資料の生成はプロプランの機能です。プロプランにアップグレードするとご利用いただけます。' : 'この組織でスライド資料を生成するには、組織オーナーのプロプラン契約が必要です。', code: 'PLAN', canManageBilling, ...(canManageBilling ? { upgradeUrl: `/shodan/pricing?org=${encodeURIComponent(sctx.organizationSlug)}` } : {}) },
      { status: 402 }
    )
  }

  const existingPrep = await prisma.shodanPreparation.findFirst({ where: { id: p.id, organizationId: sctx.organizationId, status: { not: 'deleted' } } })
  if (!existingPrep) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  let lease: string
  try {
    lease = await claimShodanSlideLease(existingPrep.id)
  } catch (error) {
    if (error instanceof ShodanSlideGenerationInProgressError) return NextResponse.json({ error: 'この資料のスライドを生成中です。完了後に再度お試しください。', code: 'GENERATION_PENDING' }, { status: 409 })
    console.error('[shodan/slides] lease unavailable')
    return NextResponse.json({ error: 'スライドの生成を開始できませんでした。時間をおいて再度お試しください。' }, { status: 503 })
  }
  try {
    // リース取得前に別の呼び出しが完了している可能性があるので、未生成枠を取り直す。
    const prep = await prisma.shodanPreparation.findFirst({ where: { id: p.id, organizationId: sctx.organizationId, status: { not: 'deleted' } } })
    if (!prep) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    const slides = (prep.slidesJson as unknown as ProposalSlide[] | null) || []
    if (!slides.length) return NextResponse.json({ error: '先に提案資料の構成を生成してください' }, { status: 400 })

    const list = slides
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
          catch (e) { console.error('[shodan/slides] slide failed') }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, worker))

      const changes = batch.filter((index) => images[index]?.imagePath).map((index) => ({ index, image: images[index] }))
      if (changes.length > 0) {
        try {
          const merged = await saveSlideImages(prep.id, sctx.organizationId, prep.slidesJson, existing, changes)
          images.splice(0, images.length, ...merged.slice(0, list.length))
        } catch (e) {
          if (e instanceof SlideImageConflict) return NextResponse.json({ error: e.message }, { status: 409 })
          console.error('[shodan/slides] save failed')
          return NextResponse.json({ error: 'スライド画像の保存に失敗しました。再読み込みしてご確認ください。' }, { status: 500 })
        }
      }
    }

    const successCount = images.filter((x) => x.imagePath).length
    if (!successCount) return NextResponse.json({ error: 'スライド画像の生成に失敗しました。時間をおいて再度お試しください。' }, { status: 500 })
    return NextResponse.json({ success: true, count: successCount, total: list.length, remaining: list.length - successCount })
  } finally {
    await releaseShodanSlideLease(existingPrep.id, lease).catch(() => console.error('[shodan/slides] lease release failed'))
  }
}
