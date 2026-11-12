export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPopupUserId, ownPopup } from '@/lib/popup/access'
import { isId, sanitizeCreative, type PopupCreative } from '@/lib/popup/schema'
import { saveImage } from '@/lib/popup/storage'
import { toPopupDto } from '@/lib/popup/dto'
import { generateAndSave, parseImageBrief, POPUP_IMAGE_DAILY_LIMIT, POPUP_IMAGE_QUOTA_SCOPE } from '@/lib/popup/imagegen'
import { generateImageWithFallback } from '@/lib/image-generator'
import { consumeDailyQuota, quotaSubject, refundDailyQuota } from '@/lib/server-daily-quota'
import { withDoyaPowerCharge, DOYA_POWER_CONSUMED_HEADER } from '@/lib/doya-power/charge'
import { recordServiceUsage } from '@/lib/service-usage'

type Ctx = { params: Promise<{ id: string }> }

// 従量課金の API。モデル・大きさ・品質はサーバーが決める（src/lib/popup/imagegen.ts。利用者には選ばせない）。
// ログイン必須・自分の画像型の案だけ・指示文に長さの上限・1人1日 POPUP_IMAGE_DAILY_LIMIT 回。
// ドヤパワーは withDoyaPowerCharge が生成の前に減らし、4xx/5xx で戻す（作り直しも毎回減る。半額にはしない）。

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store' } })

async function postHandler(req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return fail(401, 'ログインが必要です。')
  const { id } = await ctx.params
  if (!isId(id)) return fail(404, '見つかりません。')
  const popup = await prisma.popup.findFirst({ where: ownPopup(userId, id), include: { site: { select: { site: true } } } })
  if (!popup) return fail(404, '見つかりません。')
  if (popup.kind !== 'image') return fail(400, '画像を作れるのは画像のポップアップだけです。')

  const body = await req.json().catch(() => null)
  const parsed = parseImageBrief(body)
  if (!parsed.ok) return fail(400, parsed.error)

  const quota = await consumeDailyQuota(POPUP_IMAGE_QUOTA_SCOPE, quotaSubject(userId), POPUP_IMAGE_DAILY_LIMIT)
  if (quota === 'unavailable') return fail(503, '回数を確かめられないため、画像を作れません。時間をおいて、もう一度お試しください。')
  if (quota === 'limited') return fail(429, `きょう画像を作れる回数（${POPUP_IMAGE_DAILY_LIMIT}回）に達しました。あすまたお試しください。`)

  const current = popup.creative as unknown as PopupCreative
  const c = sanitizeCreative(current, current)
  const subject = quotaSubject(userId)
  // 失敗のときに回数・ドヤパワーを戻すかは generateAndSave が決める（作られて課金されたあとの失敗では戻さない）
  const r = await generateAndSave(
    { generate: generateImageWithFallback, save: (buf) => saveImage(userId, popup.id, buf) },
    { site: (popup.site.site || {}) as any, brief: parsed.brief, colors: c.colors, layout: c.layout }
  )
  if (!r.ok) {
    if (r.refundQuota) await refundDailyQuota(POPUP_IMAGE_QUOTA_SCOPE, subject)
    console.error('[popup/image/generate] failed', { status: r.status, refundQuota: r.refundQuota, consumed: r.consumed })
    const res = fail(r.status, r.message)
    if (r.consumed) res.headers.set(DOYA_POWER_CONSUMED_HEADER, '1')
    return res
  }
  try {
    const alt = c.imageAlt || parsed.brief.headline || parsed.brief.message.slice(0, 60)
    const creative = sanitizeCreative({ imageAlt: alt }, { ...c, imagePath: r.saved.path, imageWidth: r.saved.width, imageHeight: r.saved.height })
    const updated = await prisma.popup.update({ where: { id: popup.id }, data: { creative: creative as any } })
    void recordServiceUsage({ userId, serviceId: 'popup', action: 'ポップアップの画像を作成', summary: popup.name.slice(0, 60), count: 1 })
    return NextResponse.json({ popup: toPopupDto(updated) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    // 画像は作られている（課金された）。回数もドヤパワーも戻さない
    console.error('[popup/image/generate] db update failed')
    const res = fail(500, '画像は作れましたが、案への反映に失敗しました。時間をおいて、もう一度お試しください。')
    res.headers.set(DOYA_POWER_CONSUMED_HEADER, '1')
    return res
  }
}

const invalidBrief = (b: Record<string, unknown> | null) => {
  const r = parseImageBrief(b)
  return r.ok ? null : r.error
}
export const POST = withDoyaPowerCharge({ action: 'popup.image', invalid: invalidBrief }, postHandler)
