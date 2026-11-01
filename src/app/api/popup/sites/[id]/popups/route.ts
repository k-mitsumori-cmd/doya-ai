export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { SiteProfile } from '@/lib/asklink/types'
import { getPopupUserId, ownPopup, ownSite } from '@/lib/popup/access'
import { blankProposal } from '@/lib/popup/proposals'
import { isId, POPUP_KINDS, type PopupKind } from '@/lib/popup/schema'
import { toPopupDto } from '@/lib/popup/dto'

type Ctx = { params: Promise<{ id: string }> }

/** 1サイトに置ける案の数（並べすぎると管理できず、embed の設定も重くなる） */
const MAX_POPUPS_PER_SITE = 20

/**
 * 案を追加する。{ kind } で空の案、{ duplicateOf } で既存の案の複製（下書きで作る）。
 * AIは呼ばない（利用枠を使わない）。
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })
  const site = await prisma.popupSite.findFirst({ where: ownSite(userId, id), select: { id: true, site: true } })
  if (!site) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })

  const count = await prisma.popup.count({ where: { siteId: site.id, userId } })
  if (count >= MAX_POPUPS_PER_SITE) {
    return NextResponse.json({ error: `1つのサイトに作れるポップアップは${MAX_POPUPS_PER_SITE}個までです。` }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  let data
  if (isId(body?.duplicateOf)) {
    const src = await prisma.popup.findFirst({ where: { ...ownPopup(userId, body.duplicateOf), siteId: site.id } })
    if (!src) return NextResponse.json({ error: '複製元が見つかりません。' }, { status: 404 })
    data = {
      kind: src.kind,
      name: `${src.name}（コピー）`.slice(0, 40),
      creative: src.creative as any,
      trigger: src.trigger as any,
      targeting: src.targeting as any,
      frequency: src.frequency as any,
      reason: src.reason,
    }
  } else {
    const kind: PopupKind = POPUP_KINDS.includes(body?.kind) ? body.kind : 'image'
    const p = blankProposal(kind, site.site as unknown as SiteProfile)
    data = { kind: p.kind, name: p.name, creative: p.creative as any, trigger: p.trigger as any, targeting: p.targeting as any, frequency: p.frequency as any, reason: null }
  }
  const popup = await prisma.popup.create({ data: { ...data, siteId: site.id, userId, status: 'draft', sortOrder: count } })
  return NextResponse.json({ popup: toPopupDto(popup) })
}
