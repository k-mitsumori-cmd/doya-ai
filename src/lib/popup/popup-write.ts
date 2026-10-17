// ============================================
// ドヤポップアップ: 案の編集・公開（PATCH /api/popup/popups/[id] とエージェントの道具 popup.publish の正本）
// ============================================
// ⚠️ 保存する値は必ずここで検査し直す（画面の判定は表示用）。
// - AIに聞く型の質問文は asklink の機械チェック（禁止表現・サイトに無いURL・文字数・URL長）を通し、
//   ボタンのURLはここで組み立てる
// - 公開（live）にするときは、足りないものが無いことを確かめる
// ⚠️ 公開は外部のサイトに表示が出る操作。エージェントからは承認必須（agent-tools.ts）。
import { prisma } from '@/lib/prisma'
import { buildChatgptUrl, checkQuestion } from '@/lib/asklink/link'
import {
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
} from './schema'
import { toPopupDto, type PopupDto } from './dto'

export type UpdateResult =
  | { ok: true; popup: PopupDto }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 422; error: string; issues: string[]; chars?: number; urlLength?: number }

function allowedUrlsOf(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((u): u is string => typeof u === 'string') : []
}

/** 案を更新する。body は API と同じ形（name / status / sortOrder / creative / trigger / targeting / frequency） */
export async function updatePopup(userId: string, popupId: string, body: Record<string, any>): Promise<UpdateResult> {
  const popup = await prisma.popup.findFirst({
    where: { id: popupId, userId, site: { deletedAt: null } },
    include: { site: { select: { allowedUrls: true } } },
  })
  if (!popup) return { ok: false, status: 404, error: '見つかりません。' }

  const kind = popup.kind as PopupKind
  const current = popup.creative as unknown as PopupCreative
  const allowedUrls = allowedUrlsOf(popup.site.allowedUrls)

  let creative = body?.creative ? sanitizeCreative(body.creative, current) : sanitizeCreative(current, current)
  if (kind === 'ask' && body?.creative && 'question' in body.creative) {
    const check = checkQuestion(creative.question, allowedUrls)
    if (!check.ok) return { ok: false, status: 422, error: '質問文を直してください。', issues: check.issues, chars: check.chars, urlLength: check.urlLength }
    creative = { ...creative, buttonUrl: buildChatgptUrl(creative.question) }
  }

  const status: PopupStatus = POPUP_STATUSES.includes(body?.status) ? body.status : (popup.status as PopupStatus)
  if (status === 'live') {
    const issues = publishIssues(kind, creative)
    if (kind === 'ask' && creative.question) {
      const check = checkQuestion(creative.question, allowedUrls)
      if (!check.ok) issues.push(...check.issues.map((i) => `質問文: ${i}`))
    }
    if (issues.length) return { ok: false, status: 422, error: '公開する前に直してください。', issues }
  }

  const sortOrder = Number.isInteger(body?.sortOrder) ? Math.min(999, Math.max(0, body.sortOrder)) : popup.sortOrder
  const updated = await prisma.popup.update({
    where: { id: popup.id },
    data: {
      name: body && 'name' in body ? sanitizeName(body.name, popup.name) : popup.name,
      status,
      sortOrder,
      creative: creative as any,
      trigger: body?.trigger ? (sanitizeTrigger(body.trigger) as any) : undefined,
      targeting: body?.targeting ? (sanitizeTargeting(body.targeting) as any) : undefined,
      frequency: body?.frequency ? (sanitizeFrequency(body.frequency) as any) : undefined,
    },
  })
  return { ok: true, popup: toPopupDto(updated) }
}

/** 公開・停止の切り替えだけ（エージェントの道具 popup.publish が呼ぶ） */
export function setPopupStatus(userId: string, popupId: string, status: Extract<PopupStatus, 'live' | 'paused'>): Promise<UpdateResult> {
  return updatePopup(userId, popupId, { status })
}
