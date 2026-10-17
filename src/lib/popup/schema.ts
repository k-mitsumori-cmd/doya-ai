// ============================================
// ドヤポップアップ: 保存する設定の形と入力検査（仕様: reference/services/popup.md 3章・4章）
// ============================================
// ⚠️ creative / trigger / targeting / frequency は JSON 列に入る。API で受けた値は
//    必ずここの sanitize*() を通してから保存する（形の正本はこのファイル）。
// ⚠️ ここは DB や Next.js に依存させない（単体テストと embed の仕様確認で直接読む）。

export type PopupKind = 'ask' | 'cta' | 'pages' | 'image'
export type PopupStatus = 'draft' | 'live' | 'paused'
export type PopupLayout = 'modal' | 'slide' | 'bar'

export const POPUP_KINDS: PopupKind[] = ['ask', 'cta', 'pages', 'image']
export const POPUP_STATUSES: PopupStatus[] = ['draft', 'live', 'paused']
export const POPUP_LAYOUTS: PopupLayout[] = ['modal', 'slide', 'bar']

export const KIND_LABEL: Record<PopupKind, string> = {
  ask: 'AIに聞く',
  cta: '相談・申し込み',
  pages: 'おすすめページ',
  image: '画像',
}

export const LAYOUT_LABEL: Record<PopupLayout, string> = {
  modal: '中央に表示',
  slide: '右下に表示',
  bar: '下部に帯で表示',
}

export const STATUS_LABEL: Record<PopupStatus, string> = {
  draft: '下書き',
  live: '公開中',
  paused: '停止中',
}

/** 文言の上限（文字数）。長いとポップアップが崩れる */
export const LIMITS = {
  name: 40,
  eyebrow: 30,
  headline: 30,
  sub: 60,
  bubble: 12,
  buttonLabel: 20,
  note: 30,
  linkLabel: 30,
  /** AIに聞く型の質問文（asklink の QUESTION_MAX_CHARS と同じ） */
  question: 450,
  /** 質問リンクのURL（asklink の URL_MAX_LENGTH と同じ） */
  url: 4000,
  links: 3,
  paths: 10,
  path: 200,
} as const

export interface PopupColors {
  /** 背景 */
  bg: string
  /** ボタン・強調 */
  accent: string
  /** 文字 */
  text: string
}

export interface PopupLinkItem {
  label: string
  url: string
}

export interface PopupCreative {
  layout: PopupLayout
  /** 上に小さく出す文字（サイト名など）。空なら出さない */
  eyebrow: string
  headline: string
  sub: string
  /** 吹き出し（AIに聞く型のみ使う）。0〜3個 */
  bubbles: string[]
  buttonLabel: string
  /** ボタンの行き先。空ならボタンを出さない */
  buttonUrl: string
  /** ボタンの下の小さな注記（例: ChatGPTが開きます） */
  note: string
  /**
   * AIに聞く型の質問文。ボタンのURLはここから asklink の buildLink() で組み立てる
   * （利用者が質問文を直したら、サーバ側でURLと機械チェックを作り直す）
   */
  question: string
  /** リンク一覧（おすすめページ型）。0〜3件 */
  links: PopupLinkItem[]
  colors: PopupColors
  /** 画像型のときの Storage パス。公開APIでは画像URLに置き換えて返す */
  imagePath: string | null
  /** 画像の縦横（レイアウトのずれ防止） */
  imageWidth: number | null
  imageHeight: number | null
  /** 画像の代替テキスト */
  imageAlt: string
}

export type TriggerType = 'delay' | 'scroll' | 'exit'

export interface PopupTrigger {
  type: TriggerType
  /** delay: 表示までの秒数 / exit: スマホで置き換える秒数 */
  delaySec: number
  /** scroll: 何％スクロールしたら */
  scrollPct: number
}

export type DeviceTarget = 'all' | 'pc' | 'sp'

export interface PopupTargeting {
  device: DeviceTarget
  /** 'all' = すべてのページ / 'include' = paths に合うページだけ */
  pathMode: 'all' | 'include'
  paths: string[]
}

export interface PopupFrequency {
  /** 閉じたら何日出さないか（0 = 次のページ表示でまた出る） */
  hideDays: number
  /** 同じ訪問（タブ）では1回まで */
  oncePerSession: boolean
}

export const DEFAULT_COLORS: PopupColors = { bg: '#ffffff', accent: '#0066ff', text: '#1f2430' }

export const DEFAULT_TRIGGER: PopupTrigger = { type: 'delay', delaySec: 10, scrollPct: 50 }
export const DEFAULT_TARGETING: PopupTargeting = { device: 'all', pathMode: 'all', paths: [] }
export const DEFAULT_FREQUENCY: PopupFrequency = { hideDays: 7, oncePerSession: true }

// ---------- 基本の検査 ----------

function str(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  // 制御文字（改行・タブ以外）を落とし、前後の空白を除く
  const cleaned = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
  return Array.from(cleaned).slice(0, max).join('')
}

function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function oneOf<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return (list as readonly string[]).includes(v as string) ? (v as T) : fallback
}

/** #rgb / #rrggbb だけを受ける（CSS に入るので、それ以外の文字列は通さない） */
export function sanitizeColor(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const s = v.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + s.slice(1).split('').map((c) => c + c).join('')
  return fallback
}

/**
 * リンク先URL。http(s) のみ。`javascript:` `data:` などは空にする。
 * ⚠️ embed.js 側でも同じ判定をする（保存後に誰かがDBを書き換えても描画で止まるように）。
 */
export function sanitizeLinkUrl(v: unknown): string {
  if (typeof v !== 'string') return ''
  const s = v.trim()
  if (!s || s.length > LIMITS.url) return ''
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    if (u.username || u.password) return ''
    return u.toString()
  } catch {
    return ''
  }
}

/** ページの指定（前方一致、`*` は任意の文字列）。先頭は / に揃える */
export function sanitizePath(v: unknown): string {
  const s = str(v, LIMITS.path).replace(/\s+/g, '')
  if (!s) return ''
  // フルURLで入れられたらパスだけにする
  let p = s
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p)
      p = u.pathname + u.search
    } catch {
      return ''
    }
  }
  if (!p.startsWith('/')) p = '/' + p
  return p
}

// ---------- 各JSONの検査 ----------

export function sanitizeCreative(raw: unknown, base?: Partial<PopupCreative>): PopupCreative {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const b = base || {}
  const pickStr = (key: keyof PopupCreative, max: number) => (key in r ? str(r[key], max) : str(b[key], max))
  const colorsRaw = (r.colors && typeof r.colors === 'object' ? r.colors : b.colors || {}) as Record<string, unknown>
  const bubblesRaw = Array.isArray(r.bubbles) ? r.bubbles : Array.isArray(b.bubbles) ? b.bubbles : []
  const linksRaw = Array.isArray(r.links) ? r.links : Array.isArray(b.links) ? b.links : []
  const links: PopupLinkItem[] = []
  for (const l of linksRaw) {
    if (!l || typeof l !== 'object') continue
    const url = sanitizeLinkUrl((l as PopupLinkItem).url)
    const label = str((l as PopupLinkItem).label, LIMITS.linkLabel)
    if (!url || !label) continue
    links.push({ label, url })
    if (links.length >= LIMITS.links) break
  }
  return {
    layout: oneOf(r.layout ?? b.layout, POPUP_LAYOUTS, 'modal'),
    eyebrow: pickStr('eyebrow', LIMITS.eyebrow),
    headline: pickStr('headline', LIMITS.headline),
    sub: pickStr('sub', LIMITS.sub),
    bubbles: bubblesRaw.map((x) => str(x, LIMITS.bubble)).filter(Boolean).slice(0, 3),
    buttonLabel: pickStr('buttonLabel', LIMITS.buttonLabel),
    buttonUrl: sanitizeLinkUrl('buttonUrl' in r ? r.buttonUrl : b.buttonUrl),
    note: pickStr('note', LIMITS.note),
    question: pickStr('question', LIMITS.question),
    links,
    colors: {
      bg: sanitizeColor(colorsRaw.bg, DEFAULT_COLORS.bg),
      accent: sanitizeColor(colorsRaw.accent, DEFAULT_COLORS.accent),
      text: sanitizeColor(colorsRaw.text, DEFAULT_COLORS.text),
    },
    // ⚠️ 画像パスと縦横は利用者の入力から受けない。アップロードAPIだけが base 経由で設定する
    //    （任意のパスを入れられると、他人の Storage の画像を公開APIから配信できてしまう）
    imagePath: b.imagePath ?? null,
    imageWidth: b.imageWidth ?? null,
    imageHeight: b.imageHeight ?? null,
    imageAlt: pickStr('imageAlt', 100),
  }
}

export function sanitizeTrigger(raw: unknown): PopupTrigger {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    type: oneOf(r.type, ['delay', 'scroll', 'exit'] as const, DEFAULT_TRIGGER.type),
    delaySec: int(r.delaySec, 0, 600, DEFAULT_TRIGGER.delaySec),
    scrollPct: int(r.scrollPct, 10, 100, DEFAULT_TRIGGER.scrollPct),
  }
}

export function sanitizeTargeting(raw: unknown): PopupTargeting {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const paths = (Array.isArray(r.paths) ? r.paths : [])
    .map(sanitizePath)
    .filter(Boolean)
    .filter((p, i, a) => a.indexOf(p) === i)
    .slice(0, LIMITS.paths)
  const pathMode = oneOf(r.pathMode, ['all', 'include'] as const, 'all')
  return {
    device: oneOf(r.device, ['all', 'pc', 'sp'] as const, 'all'),
    // 指定が空なら「すべて」に戻す（どのページにも出ない設定を作らせない）
    pathMode: pathMode === 'include' && paths.length > 0 ? 'include' : 'all',
    paths,
  }
}

export function sanitizeFrequency(raw: unknown): PopupFrequency {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    hideDays: int(r.hideDays, 0, 365, DEFAULT_FREQUENCY.hideDays),
    oncePerSession: typeof r.oncePerSession === 'boolean' ? r.oncePerSession : DEFAULT_FREQUENCY.oncePerSession,
  }
}

export function sanitizeName(v: unknown, fallback: string): string {
  return str(v, LIMITS.name) || fallback
}

/** 公開してよい状態か。足りないものを利用者向けの文言で返す */
export function publishIssues(kind: PopupKind, c: PopupCreative): string[] {
  const issues: string[] = []
  if (kind === 'image') {
    if (!c.imagePath) issues.push('画像をアップロードしてください')
    if (!c.buttonUrl) issues.push('画像を押したときのリンク先URLを入れてください')
    return issues
  }
  if (!c.headline) issues.push('見出しを入れてください')
  if (kind === 'pages') {
    if (c.links.length === 0 && !c.buttonUrl) issues.push('リンクを1つ以上入れてください')
  } else if (!c.buttonUrl || !c.buttonLabel) {
    issues.push('ボタンの文言とリンク先URLを入れてください')
  }
  return issues
}

// ---------- ドメイン・パスの照合（公開APIと embed で同じ規則） ----------

/** ホストの正規化（小文字・www なし・ポートなし） */
export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '')
}

/** 登録ドメインの入力を正規化する。URLでもホストだけでも受ける。不正なら null */
export function parseDomain(raw: unknown): string | null {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s || s.length > 253) return null
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    const h = normalizeHost(u.hostname)
    if (!h.includes('.') || !/^[a-z0-9.-]+$/.test(h)) return null
    return h
  } catch {
    return null
  }
}

/**
 * Origin（または Referer）のホストが登録ドメインか、そのサブドメインか。
 * ⚠️ 「末尾が一致」だけで判定しない（evil-example.com が example.com に一致してしまう）。
 */
export function hostMatchesDomain(host: string, domain: string): boolean {
  const h = normalizeHost(host)
  const d = normalizeHost(domain)
  if (!h || !d) return false
  return h === d || h.endsWith('.' + d)
}

/** Origin / Referer ヘッダからホストを取り出す。取れなければ null */
export function hostFromHeader(value: string | null | undefined): string | null {
  if (!value || value === 'null') return null
  try {
    return new URL(value).hostname
  } catch {
    return null
  }
}

/**
 * ページ指定に合うか。前方一致、`*` は任意の文字列。
 * ⚠️ embed.js の matchPath と同じ規則にすること（テストで両方を確かめる）。
 */
export function pathMatches(pattern: string, pathname: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp('^' + escaped).test(pathname)
}

export function targetingMatches(t: PopupTargeting, pathname: string): boolean {
  if (t.pathMode !== 'include') return true
  return t.paths.some((p) => pathMatches(p, pathname))
}

// ---------- 計測 ----------

export type TrackEvent = 'impression' | 'click' | 'close'
export const TRACK_EVENTS: TrackEvent[] = ['impression', 'click', 'close']

/** 計測の target。'main' か 'link:0'〜'link:2' だけ */
export function sanitizeTarget(v: unknown): string | null {
  if (v === undefined || v === null || v === '' || v === 'main') return 'main'
  if (typeof v === 'string' && /^link:[0-2]$/.test(v)) return v
  return null
}

/** JST の日付（00:00 UTC の Date。@db.Date 列に入れる） */
export function jstDay(now = new Date()): Date {
  const jst = new Date(now.getTime() + 9 * 3600_000)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()))
}

/** クリック率（％、小数1桁）。表示0なら null */
export function ctr(clicks: number, impressions: number): number | null {
  if (!impressions) return null
  return Math.round((clicks / impressions) * 1000) / 10
}

/** 埋め込みタグの公開キー（推測できない乱数。URLに載る文字だけ） */
export function isSiteKey(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{20,40}$/.test(v)
}

/** 利用者が送ってくるID（cuid） */
export function isId(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z0-9]{20,40}$/i.test(v)
}
