export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getShodanContext, orgSlugFrom } from '@/lib/shodan/access'
import { effectivePrepStatus } from '@/lib/shodan/types'
import { shodanSlideLeaseKey } from '@/lib/shodan/slide-generation-lease'
import { signedUrl } from '@/lib/shodan/storage'
import { slideImageKey } from '@/lib/shodan/slide-image-identity'
import type { StoredSlide } from '@/lib/shodan/slide-image'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/shodan/preparations/[id] — 詳細（成果物フル）
export async function GET(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  // organizationId + id の両方で検索（IDOR防止）
  let item = await prisma.shodanPreparation.findFirst({
    where: { id: p.id, organizationId: sctx.organizationId, status: { not: 'deleted' } },
  })
  if (!item) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  // Vercelタイムアウト等で 'processing' のまま放置された案件を救済（catchが走らず残るケース）。
  // 判定は共有の effectivePrepStatus に一本化（list GET と同一ルール）。
  if (item.status === 'processing' && effectivePrepStatus(item.status, item.updatedAt) === 'failed') {
    const updated = await prisma.shodanPreparation.updateMany({
      where: { id: item.id, organizationId: sctx.organizationId, status: 'processing', updatedAt: item.updatedAt },
      data: { status: 'failed', errorMessage: '生成がタイムアウトしました。再度お試しください。' },
    })
    if (updated.count !== 1) {
      const refreshed = await prisma.shodanPreparation.findFirst({ where: { id: item.id, organizationId: sctx.organizationId, status: { not: 'deleted' } } })
      if (!refreshed) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
      item = refreshed
    } else item = { ...item, status: 'failed', errorMessage: '生成がタイムアウトしました。再度お試しください。' }
  }
  // 提案スライド画像は非公開保存のため、表示用に署名URLへ変換して返す
  const stored = (item.slideImages as unknown as StoredSlide[] | null) || []
  const slideImages = stored.length
    ? await Promise.all(stored.map(async (s) => ({ title: s.title, role: s.role, imageUrl: await signedUrl(s.imagePath), imageKey: slideImageKey(s.imagePath) })))
    : item.slideImages
  return NextResponse.json({ item: { ...item, errorMessage: item.errorMessage ? '処理に失敗しました。再度お試しください。' : null, slideImages } }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}

// DELETE /api/shodan/preparations/[id]
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(p.id)) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const result = await prisma.$transaction(async (tx) => {
    // 予約と同じ組織ロックで利用枠の更新を直列化する。
    await tx.$queryRaw`SELECT id FROM shodan_organizations WHERE id = ${sctx.organizationId} FOR NO KEY UPDATE`
    const key = shodanSlideLeaseKey(p.id)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM shodan_preparations WHERE id = ${p.id} AND "organizationId" = ${sctx.organizationId} FOR UPDATE
    `
    if (!locked.length) return 'missing' as const
    const item = await tx.shodanPreparation.findFirst({ where: { id: p.id, organizationId: sctx.organizationId } })
    if (!item || item.status === 'deleted') return 'missing' as const
    if (effectivePrepStatus(item.status, item.updatedAt) === 'processing') return 'processing' as const
    const lease = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    if (lease) {
      const expiresAt = Number(lease.value.split(':', 1)[0])
      if (!Number.isSafeInteger(expiresAt) || expiresAt > Date.now()) return 'generating' as const
    }
    if (effectivePrepStatus(item.status, item.updatedAt) === 'failed') {
      await tx.shodanPreparation.delete({ where: { id: item.id } })
      return 'deleted' as const
    }
    await tx.shodanPreparation.update({ where: { id: item.id }, data: {
      status: 'deleted', targetUrl: '', targetName: null, createdByMemberId: null,
      research: Prisma.DbNull, analysis: Prisma.DbNull, proposalMarkdown: null,
      slidesJson: Prisma.DbNull, slideImages: Prisma.DbNull, errorMessage: null,
    } })
    return 'deleted' as const
  }, { maxWait: 10000, timeout: 30000 })
  if (result === 'missing') return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (result === 'processing') return NextResponse.json({ error: '企業調査が進行中です。完了後に削除してください。' }, { status: 409 })
  if (result === 'generating') return NextResponse.json({ error: '資料を生成中です。完了後に削除してください。' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
