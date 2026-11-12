export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPopupUserId, ownPopup } from '@/lib/popup/access'
import { isId, sanitizeCreative, type PopupCreative } from '@/lib/popup/schema'
import { saveImage } from '@/lib/popup/storage'
import { toPopupDto } from '@/lib/popup/dto'
import { generatePopupImage, parseImageBrief, POPUP_IMAGE_DAILY_LIMIT, POPUP_IMAGE_QUOTA_SCOPE } from '@/lib/popup/imagegen'
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
  try {
    const r = await generatePopupImage(
      { generate: generateImageWithFallback },
      { site: (popup.site.site || {}) as any, brief: parsed.brief, colors: c.colors, layout: c.layout }
    )
    if (!r.ok) {
      await refundDailyQuota(POPUP_IMAGE_QUOTA_SCOPE, quotaSubject(userId))
      return fail(502, '作った画像が大きすぎて保存できませんでした。もう一度作り直してください。')
    }
    const saved = await saveImage(userId, popup.id, r.image)
    if ('error' in saved) {
      // 画像は作られている（課金された）ので、ドヤパワーは戻さない。回数だけ戻す
      await refundDailyQuota(POPUP_IMAGE_QUOTA_SCOPE, quotaSubject(userId))
      const res = fail(502, '画像を保存できませんでした。時間をおいて、もう一度お試しください。')
      res.headers.set(DOYA_POWER_CONSUMED_HEADER, '1')
      return res
    }
    const alt = c.imageAlt || parsed.brief.headline || parsed.brief.message.slice(0, 60)
    const creative = sanitizeCreative({ imageAlt: alt }, { ...c, imagePath: saved.path, imageWidth: saved.width, imageHeight: saved.height })
    const updated = await prisma.popup.update({ where: { id: popup.id }, data: { creative: creative as any } })
    void recordServiceUsage({ userId, serviceId: 'popup', action: 'ポップアップの画像を作成', summary: popup.name.slice(0, 60), count: 1 })
    return NextResponse.json({ popup: toPopupDto(updated) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    const status = (e as { status?: unknown })?.status
    console.error('[popup/image/generate] failed', { status: typeof status === 'number' ? status : undefined, name: e instanceof Error ? e.name : 'unknown' })
    await refundDailyQuota(POPUP_IMAGE_QUOTA_SCOPE, quotaSubject(userId))
    const res = fail(502, '画像を作れませんでした。時間をおいて、もう一度お試しください。')
    // 上流が応答を返さなかった（時間切れ・切断）ときは、作られたか分からないので、ドヤパワーは戻さない
    if (typeof status !== 'number') res.headers.set(DOYA_POWER_CONSUMED_HEADER, '1')
    return res
  }
}

// ドヤパワー（旗 DOYA_POWER_ROLLOUT の内側だけ）。見出し・伝えたいことの長さが上限を超えるときは、減らす前に 400 で断る
const invalidBrief = (b: Record<string, unknown> | null) => {
  const r = parseImageBrief(b)
  return r.ok ? null : r.error
}
export const POST = withDoyaPowerCharge({ action: 'popup.image', invalid: invalidBrief }, postHandler)
