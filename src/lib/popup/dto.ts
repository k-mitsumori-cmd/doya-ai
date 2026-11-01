// ============================================
// ドヤポップアップ: 画面・埋め込みに返す形
// ============================================
// ⚠️ 埋め込み用（toEmbedPopup）には表示に必要な項目だけを入れる。
//    userId・抽出結果・提案理由・質問文の元データは第三者のサイトに出さない。
import type { Popup, PopupSite } from '@prisma/client'
import type { SiteProfile } from '@/lib/asklink/types'
import {
  publishIssues,
  sanitizeCreative,
  sanitizeFrequency,
  sanitizeTargeting,
  sanitizeTrigger,
  type PopupCreative,
  type PopupFrequency,
  type PopupKind,
  type PopupStatus,
  type PopupTargeting,
  type PopupTrigger,
} from './schema'
import { emptyTotals, type StatTotals } from './stats'

/**
 * このアプリの公開URL（埋め込みタグ・公開APIの宛先）。
 * ⚠️ VERCEL_URL は使わない（プレビューのURLになり、本番のタグに混ざる）。NEXTAUTH_URL を正にする。
 */
export function appOrigin(): string {
  const raw = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.surisuta.jp'
  try {
    return new URL(raw).origin
  } catch {
    return 'https://doya-ai.surisuta.jp'
  }
}

export function embedCode(siteKey: string): string {
  return `<script async src="${appOrigin()}/popup/embed.js" data-site="${siteKey}"></script>`
}

/** 画像の配信URL。パスのハッシュを付けて、差し替えたらキャッシュが切り替わるようにする */
export function imageUrl(popupId: string, imagePath: string | null, absolute = false): string | null {
  if (!imagePath) return null
  const v = imagePath.split('/').pop()?.split('.')[0] || ''
  return `${absolute ? appOrigin() : ''}/api/popup/public/image/${popupId}?v=${v}`
}

export interface PopupDto {
  id: string
  siteId: string
  name: string
  kind: PopupKind
  status: PopupStatus
  sortOrder: number
  creative: PopupCreative
  imageUrl: string | null
  trigger: PopupTrigger
  targeting: PopupTargeting
  frequency: PopupFrequency
  reason: string | null
  /** 公開に足りないもの（空なら公開できる） */
  issues: string[]
  totals: StatTotals
  updatedAt: string
}

export function toPopupDto(p: Popup, totals?: StatTotals): PopupDto {
  const creative = sanitizeCreative(p.creative, p.creative as Partial<PopupCreative>)
  const kind = p.kind as PopupKind
  return {
    id: p.id,
    siteId: p.siteId,
    name: p.name,
    kind,
    status: p.status as PopupStatus,
    sortOrder: p.sortOrder,
    creative,
    imageUrl: imageUrl(p.id, creative.imagePath),
    trigger: sanitizeTrigger(p.trigger),
    targeting: sanitizeTargeting(p.targeting),
    frequency: sanitizeFrequency(p.frequency),
    reason: p.reason,
    issues: publishIssues(kind, creative),
    totals: totals || emptyTotals(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

export interface SiteDto {
  id: string
  name: string
  sourceUrl: string
  domain: string
  siteKey: string
  embedCode: string
  audience: 'b2b' | 'b2c'
  site: SiteProfile
  /** 埋め込みタグからの最終アクセス（設置確認） */
  lastSeenAt: string | null
  createdAt: string
  liveCount: number
  totals: StatTotals
}

export function toSiteDto(s: PopupSite, extra: { liveCount: number; totals: StatTotals }): SiteDto {
  return {
    id: s.id,
    name: s.name,
    sourceUrl: s.sourceUrl,
    domain: s.domain,
    siteKey: s.siteKey,
    embedCode: embedCode(s.siteKey),
    audience: s.audience === 'b2c' ? 'b2c' : 'b2b',
    site: s.site as unknown as SiteProfile,
    lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    liveCount: extra.liveCount,
    totals: extra.totals,
  }
}

/** 埋め込み（embed.js）に渡す1件分。表示に要るものだけ */
export interface EmbedPopup {
  id: string
  kind: PopupKind
  layout: PopupCreative['layout']
  eyebrow: string
  headline: string
  sub: string
  bubbles: string[]
  buttonLabel: string
  buttonUrl: string
  note: string
  links: { label: string; url: string }[]
  colors: PopupCreative['colors']
  image: { url: string; width: number | null; height: number | null; alt: string } | null
  trigger: PopupTrigger
  targeting: PopupTargeting
  frequency: PopupFrequency
}

export function toEmbedPopup(p: Pick<Popup, 'id' | 'kind' | 'creative' | 'trigger' | 'targeting' | 'frequency'>, absolute = true): EmbedPopup {
  const c = sanitizeCreative(p.creative, p.creative as Partial<PopupCreative>)
  const url = imageUrl(p.id, c.imagePath, absolute)
  return {
    id: p.id,
    kind: p.kind as PopupKind,
    layout: c.layout,
    eyebrow: c.eyebrow,
    headline: c.headline,
    sub: c.sub,
    bubbles: c.bubbles,
    buttonLabel: c.buttonLabel,
    buttonUrl: c.buttonUrl,
    note: c.note,
    links: c.links,
    colors: c.colors,
    image: p.kind === 'image' && url ? { url, width: c.imageWidth, height: c.imageHeight, alt: c.imageAlt } : null,
    trigger: sanitizeTrigger(p.trigger),
    targeting: sanitizeTargeting(p.targeting),
    frequency: sanitizeFrequency(p.frequency),
  }
}
