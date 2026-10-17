// ============================================
// ドヤポップアップ: 提案（3案）の組み立て（仕様: reference/services/popup.md 3-1）
// ============================================
// ⚠️ AIを呼ぶのは asklink の readSite / generateLinks / generateBannerCopy だけ。
//    B・C 案の文言はテンプレートで作り、LLM の呼び出しを増やさない（1回の提案の原価を抑える）。
// ⚠️ リンク先は readSite が「ページ内リンクから番号で選んだURL」だけ。ここで新しいURLを作らない。
import { BANNER_NOTE_TEXT, type AskLink, type Audience, type BannerCopy, type SiteProfile } from '@/lib/asklink/types'
import {
  DEFAULT_COLORS,
  sanitizeCreative,
  sanitizeFrequency,
  sanitizeTargeting,
  sanitizeTrigger,
  type PopupColors,
  type PopupCreative,
  type PopupFrequency,
  type PopupKind,
  type PopupLinkItem,
  type PopupTargeting,
  type PopupTrigger,
} from './schema'

export interface Proposal {
  kind: PopupKind
  name: string
  reason: string
  creative: PopupCreative
  trigger: PopupTrigger
  targeting: PopupTargeting
  frequency: PopupFrequency
}

// ---------- 色 ----------

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 相対輝度（WCAG） */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 1
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/**
 * サイトの主要色からボタンの色を選ぶ。白文字が読める濃さ（コントラスト3以上）のものだけ。
 * ⚠️ サイトの色は白や薄いグレーであることが多い。そのまま使うとボタンの白文字が読めない。
 */
export function pickColors(siteColors: string[]): PopupColors {
  for (const c of siteColors) {
    const hex = typeof c === 'string' ? c.trim().toLowerCase() : ''
    if (!hexToRgb(hex)) continue
    const full = hex.startsWith('#') ? hex : '#' + hex
    if (contrastRatio(full, '#ffffff') >= 3) return { ...DEFAULT_COLORS, accent: full }
  }
  return { ...DEFAULT_COLORS }
}

// ---------- 各案 ----------

function askProposal(site: SiteProfile, link: AskLink, copy: BannerCopy, colors: PopupColors): Proposal {
  return {
    kind: 'ask',
    name: 'A. AIに聞く',
    reason:
      'ページを半分まで読んだ訪問者に出します。サイトのことを、その場でChatGPTに相談できるボタンです。' +
      (link.needsReview ? '（質問文が自動チェックを通らなかったため、公開前に内容を確認してください）' : ''),
    creative: sanitizeCreative({
      layout: 'modal',
      eyebrow: site.name,
      headline: copy.headline,
      sub: copy.sub,
      bubbles: copy.bubbles,
      buttonLabel: link.buttonLabel,
      buttonUrl: link.url,
      note: BANNER_NOTE_TEXT,
      question: link.question,
      links: [],
      colors,
    }),
    trigger: sanitizeTrigger({ type: 'scroll', scrollPct: 50, delaySec: 20 }),
    targeting: sanitizeTargeting({}),
    frequency: sanitizeFrequency({ hideDays: 7, oncePerSession: true }),
  }
}

interface CtaTemplate {
  url: string
  headline: string
  sub: string
  buttonLabel: string
  what: string
}

/** 行き先の優先順: 問い合わせ・無料相談 → 資料ダウンロード → 料金。どれも無ければ作らない */
export function pickCta(site: SiteProfile, audience: Audience): CtaTemplate | null {
  if (site.contactUrl) {
    return audience === 'b2c'
      ? { url: site.contactUrl, headline: 'ご予約・お問い合わせはこちら', sub: `${site.name}について、気になることはお気軽にお問い合わせください。`, buttonLabel: 'お問い合わせ', what: '問い合わせページ' }
      : { url: site.contactUrl, headline: 'ご相談・お問い合わせはこちら', sub: `${site.name}について、気になることはお気軽にご相談ください。`, buttonLabel: '相談してみる', what: '問い合わせ・相談ページ' }
  }
  if (site.downloadUrl) {
    return { url: site.downloadUrl, headline: '資料で詳しく見てみませんか？', sub: `${site.name}の内容を資料にまとめています。`, buttonLabel: '資料を見る', what: '資料ダウンロードページ' }
  }
  if (site.pricingUrl) {
    return { url: site.pricingUrl, headline: '料金を確認してみませんか？', sub: `${site.name}の料金プランをご案内しています。`, buttonLabel: '料金を見る', what: '料金ページ' }
  }
  return null
}

function ctaProposal(site: SiteProfile, audience: Audience, colors: PopupColors): Proposal | null {
  const t = pickCta(site, audience)
  if (!t) return null
  return {
    kind: 'cta',
    name: 'B. 相談・申し込み',
    reason: `ページを離れそうなときに、${t.what}への案内を出します。スマホではページを離れる動きを見分けられないので、25秒後に出します。`,
    creative: sanitizeCreative({
      layout: 'modal',
      eyebrow: site.name,
      headline: t.headline,
      sub: t.sub,
      bubbles: [],
      buttonLabel: t.buttonLabel,
      buttonUrl: t.url,
      note: '',
      question: '',
      links: [],
      colors,
    }),
    trigger: sanitizeTrigger({ type: 'exit', delaySec: 25, scrollPct: 50 }),
    targeting: sanitizeTargeting({}),
    frequency: sanitizeFrequency({ hideDays: 14, oncePerSession: true }),
  }
}

/** おすすめページの候補。主要ページ → 資料 → 料金 → 問い合わせの順で、重複なく最大3件 */
export function recommendedLinks(site: SiteProfile): PopupLinkItem[] {
  const out: PopupLinkItem[] = []
  const push = (label: string, url: string | null) => {
    if (!url || out.length >= 3 || out.some((x) => x.url === url)) return
    out.push({ label, url })
  }
  for (const p of site.pages) push(p.label, p.url)
  push('資料ダウンロード', site.downloadUrl)
  push('料金プラン', site.pricingUrl)
  push('お問い合わせ', site.contactUrl)
  return out
}

function pagesProposal(site: SiteProfile, audience: Audience, second: AskLink | undefined, colors: PopupColors): Proposal | null {
  const links = recommendedLinks(site)
  if (links.length === 0) return null
  return {
    kind: 'pages',
    name: 'C. おすすめページ',
    reason: 'ページを開いて15秒後に、次に読むとよいページを右下に出します。AIに相談できるボタンも一緒に出します。',
    creative: sanitizeCreative({
      layout: 'slide',
      eyebrow: site.name,
      headline: audience === 'b2c' ? 'あわせて見たいページ' : 'こちらのページもおすすめです',
      sub: `${site.name}をもっと知るための${links.length}ページ`,
      bubbles: [],
      buttonLabel: second && !second.needsReview ? second.buttonLabel : '',
      buttonUrl: second && !second.needsReview ? second.url : '',
      note: second && !second.needsReview ? BANNER_NOTE_TEXT : '',
      question: second && !second.needsReview ? second.question : '',
      links,
      colors,
    }),
    trigger: sanitizeTrigger({ type: 'delay', delaySec: 15, scrollPct: 50 }),
    targeting: sanitizeTargeting({}),
    frequency: sanitizeFrequency({ hideDays: 3, oncePerSession: true }),
  }
}

/** 3案（B・C は行き先が無ければ省く）。並び順がそのまま表示の優先順になる */
export function buildProposals(site: SiteProfile, audience: Audience, links: AskLink[], copy: BannerCopy): Proposal[] {
  const colors = pickColors(site.colors)
  const out: Proposal[] = []
  if (links[0]) out.push(askProposal(site, links[0], copy, colors))
  const cta = ctaProposal(site, audience, colors)
  if (cta) out.push(cta)
  const pages = pagesProposal(site, audience, links[1], colors)
  if (pages) out.push(pages)
  return out
}

/** 空の案（自分で一から作る・画像を使う）。画像型はアップロード後にボタン（画像のリンク先）を入れる */
export function blankProposal(kind: PopupKind, site: SiteProfile): Proposal {
  const colors = pickColors(site.colors)
  return {
    kind,
    name: kind === 'image' ? '画像のポップアップ' : '新しいポップアップ',
    reason: '',
    creative: sanitizeCreative({
      layout: 'modal',
      eyebrow: kind === 'image' ? '' : site.name,
      headline: kind === 'image' ? '' : 'お知らせ',
      sub: '',
      bubbles: [],
      buttonLabel: kind === 'image' ? '' : '詳しく見る',
      buttonUrl: '',
      note: '',
      question: '',
      links: [],
      colors,
    }),
    trigger: sanitizeTrigger({ type: 'delay', delaySec: 10 }),
    targeting: sanitizeTargeting({}),
    frequency: sanitizeFrequency({}),
  }
}
