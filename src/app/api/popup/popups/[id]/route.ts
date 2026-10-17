export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { SiteProfile } from '@/lib/asklink/types'
import { buildChatgptUrl, checkQuestion } from '@/lib/asklink/link'
import { getPopupUserId, ownPopup } from '@/lib/popup/access'
import {
  isId,
  POPUP_STATUSES,
  publishIssues,
  sanitizeCreative,
  sanitizeFrequency,
  sanitizeName,
  sanitizeTargeting,
  sanitizeTrigger,
  type PopupCreative,
  type PopupKind,
  type PopupStatus,
} from '@/lib/popup/schema'
import { embedCode, toPopupDto } from '@/lib/popup/dto'

type Ctx = { params: Promise<{ id: string }> }

const NOT_FOUND = { error: '見つかりません。' }

function allowedUrlsOf(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((u): u is string => typeof u === 'string') : []
}

/** 案の詳細と、編集画面で使うサイトの情報（リンク候補・設置タグ） */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json(NOT_FOUND, { status: 404 })
  const popup = await prisma.popup.findFirst({ where: ownPopup(userId, id), include: { site: true } })
  if (!popup) return NextResponse.json(NOT_FOUND, { status: 404 })
  const site = popup.site.site as unknown as SiteProfile
  return NextResponse.json({
    popup: toPopupDto(popup),
    site: {
      id: popup.site.id,
      name: popup.site.name,
      domain: popup.site.domain,
      sourceUrl: popup.site.sourceUrl,
      embedCode: embedCode(popup.site.siteKey),
      lastSeenAt: popup.site.lastSeenAt?.toISOString() ?? null,
      colors: Array.isArray(site?.colors) ? site.colors : [],
      // リンクの候補（サイトで実際に見つかったURLだけ）
      pages: [
        ...(site?.contactUrl ? [{ label: 'お問い合わせ・相談', url: site.contactUrl }] : []),
        ...(site?.downloadUrl ? [{ label: '資料ダウンロード', url: site.downloadUrl }] : []),
        ...(site?.pricingUrl ? [{ label: '料金', url: site.pricingUrl }] : []),
        ...(Array.isArray(site?.pages) ? site.pages : []),
      ],
      allowedUrls: allowedUrlsOf(popup.site.allowedUrls),
    },
  })
}

/**
 * 編集・公開の切り替え。保存する値は必ずサーバ側で検査し直す（画面の判定は表示用）。
 * - AIに聞く型の質問文は asklink の機械チェック（禁止表現・サイトに無いURL・文字数・URL長）を通し、
 *   ボタンのURLはここで組み立てる
 * - 公開（live）にするときは、足りないものが無いことを確かめる
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json(NOT_FOUND, { status: 404 })
  const popup = await prisma.popup.findFirst({ where: ownPopup(userId, id), include: { site: { select: { allowedUrls: true } } } })
  if (!popup) return NextResponse.json(NOT_FOUND, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const kind = popup.kind as PopupKind
  const current = popup.creative as unknown as PopupCreative
  const allowedUrls = allowedUrlsOf(popup.site.allowedUrls)

  let creative = body?.creative ? sanitizeCreative(body.creative, current) : sanitizeCreative(current, current)
  if (kind === 'ask' && body?.creative && 'question' in body.creative) {
    const check = checkQuestion(creative.question, allowedUrls)
    if (!check.ok) {
      return NextResponse.json({ error: '質問文を直してください。', issues: check.issues, chars: check.chars, urlLength: check.urlLength }, { status: 422 })
    }
    creative = { ...creative, buttonUrl: buildChatgptUrl(creative.question) }
  }

  const status: PopupStatus = POPUP_STATUSES.includes(body?.status) ? body.status : (popup.status as PopupStatus)
  if (status === 'live') {
    const issues = publishIssues(kind, creative)
    if (kind === 'ask' && creative.question) {
      const check = checkQuestion(creative.question, allowedUrls)
      if (!check.ok) issues.push(...check.issues.map((i) => `質問文: ${i}`))
    }
    if (issues.length) return NextResponse.json({ error: '公開する前に直してください。', issues }, { status: 422 })
  }

  const sortOrder = Number.isInteger(body?.sortOrder) ? Math.min(999, Math.max(0, body.sortOrder)) : popup.sortOrder
  const updated = await prisma.popup.update({
    where: { id: popup.id },
    data: {
      name: 'name' in (body || {}) ? sanitizeName(body.name, popup.name) : popup.name,
      status,
      sortOrder,
      creative: creative as any,
      trigger: body?.trigger ? (sanitizeTrigger(body.trigger) as any) : undefined,
      targeting: body?.targeting ? (sanitizeTargeting(body.targeting) as any) : undefined,
      frequency: body?.frequency ? (sanitizeFrequency(body.frequency) as any) : undefined,
    },
  })
  return NextResponse.json({ popup: toPopupDto(updated) })
}

/** 削除（集計も一緒に消える）。画像は Storage に残る（同じ画像を複製した案が使っていることがある） */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json(NOT_FOUND, { status: 404 })
  const popup = await prisma.popup.findFirst({ where: ownPopup(userId, id), select: { id: true } })
  if (!popup) return NextResponse.json(NOT_FOUND, { status: 404 })
  await prisma.popup.deleteMany({ where: { id: popup.id, userId } })
  return NextResponse.json({ ok: true })
}
