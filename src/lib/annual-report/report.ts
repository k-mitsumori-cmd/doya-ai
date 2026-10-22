// ============================================
// ドヤAI 年間レポート（共有できる画像）の集計
// ============================================
// DB の既存の記録（作った日時・件数）だけから、1年分の利用をまとめる。純粋関数だけを置く（DB・環境変数を読まない）。
// ⚠️ 顧客名・金額・社員名は、既定で出さない。利用者が選び、サーバーが許した項目（reveal）だけを結果に入れる。
//    読み込み（load.server.ts）も、許した項目しか DB から読まない。ここでは、渡されても reveal に無ければ捨てる（二重の守り）。
// ⚠️ 時間の節約は「1件あたりの目安の分数 × 件数」の換算。実測ではないので、画像にも「目安」と書く。
// ⚠️ 有料の外部 API は使わない。

/** 数えるツール。user … 本人が作ったもの / org … 本人の会社（組織）で作ったもの */
export interface AnnualTool {
  id: AnnualToolId
  label: string
  unit: string
  /** 1件あたり、手で作るのに比べて節約できる時間の目安（分）。0 は時間に換算しない */
  minutesPerItem: number
  scope: 'user' | 'org'
}

export type AnnualToolId =
  | 'banner'
  | 'seo'
  | 'adimage'
  | 'asklink'
  | 'popup'
  | 'shanai'
  | 'doyaslide'
  | 'interview'
  | 'quote'
  | 'shodan'
  | 'mensetsu'
  | 'aishodan'
  | 'sfa'

/** 目安の分数は控えめにする（大きく見せない） */
export const ANNUAL_TOOLS: readonly AnnualTool[] = [
  { id: 'banner', label: 'バナー', unit: '枚', minutesPerItem: 30, scope: 'user' },
  { id: 'adimage', label: '広告の画像', unit: '枚', minutesPerItem: 20, scope: 'user' },
  { id: 'seo', label: 'SEO の記事', unit: '本', minutesPerItem: 180, scope: 'user' },
  { id: 'shanai', label: '社内インタビューの記事', unit: '本', minutesPerItem: 180, scope: 'user' },
  { id: 'interview', label: 'インタビューの記事', unit: '本', minutesPerItem: 180, scope: 'user' },
  { id: 'doyaslide', label: 'スライド', unit: '件', minutesPerItem: 120, scope: 'user' },
  { id: 'asklink', label: '質問リンク', unit: '回', minutesPerItem: 30, scope: 'user' },
  { id: 'popup', label: 'ポップアップの提案', unit: '回', minutesPerItem: 45, scope: 'user' },
  { id: 'quote', label: '見積書', unit: '件', minutesPerItem: 20, scope: 'org' },
  { id: 'shodan', label: '商談の準備', unit: '件', minutesPerItem: 90, scope: 'org' },
  { id: 'mensetsu', label: 'AI 面接', unit: '件', minutesPerItem: 30, scope: 'org' },
  { id: 'aishodan', label: 'AI 商談', unit: '件', minutesPerItem: 30, scope: 'org' },
  { id: 'sfa', label: '受注した商談', unit: '件', minutesPerItem: 0, scope: 'org' },
]

const TOOL_BY_ID = new Map(ANNUAL_TOOLS.map((t) => [t.id, t]))

/** 画像に入れるかを利用者が選べる項目 */
export type RevealKey = 'company' | 'customers' | 'amounts' | 'members'

export const REVEAL_KEYS: readonly RevealKey[] = ['company', 'customers', 'amounts', 'members']

export const REVEAL_LABELS: Record<RevealKey, string> = {
  company: '会社名',
  customers: '主な取引先の名前',
  amounts: '金額（見積・受注）',
  members: 'よく使った人の名前',
}

/** 何も選ばないときに出す項目。顧客名・金額・社員名は入れない */
export const DEFAULT_REVEAL: readonly RevealKey[] = ['company']

/** 会社の管理者（owner・admin）でないと出せない項目 */
export const SENSITIVE_REVEAL: readonly RevealKey[] = ['customers', 'amounts', 'members']

export type ImageSize = 'wide' | 'tall'

export const IMAGE_SIZES: Record<ImageSize, { width: number; height: number; label: string }> = {
  wide: { width: 1200, height: 630, label: '横長（1200×630）' },
  tall: { width: 1080, height: 1350, label: '縦長（1080×1350）' },
}

// ---- 入力の読み取り（サーバーで確かめる）----

/** 年。数字4桁で、2024年から今年まで。それ以外は今年 */
export function parseYear(raw: unknown, now: Date): number {
  const thisYear = jstYear(now)
  const s = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : ''
  if (!/^\d{4}$/.test(s)) return thisYear
  const y = Number(s)
  return y >= MIN_YEAR && y <= thisYear ? y : thisYear
}

export const MIN_YEAR = 2024

export function parseSize(raw: unknown): ImageSize {
  return raw === 'tall' ? 'tall' : 'wide'
}

/**
 * 利用者が選んだ項目を読む。知らない名前は捨てる。null（指定なし）は既定（会社名だけ）。
 * 空の文字列は「何も出さない」。
 */
export function parseRevealRequest(raw: string | null | undefined): RevealKey[] {
  if (raw == null) return [...DEFAULT_REVEAL]
  const out: RevealKey[] = []
  for (const part of raw.split(',')) {
    const k = part.trim() as RevealKey
    if ((REVEAL_KEYS as readonly string[]).includes(k) && !out.includes(k)) out.push(k)
  }
  return out
}

/** 選んだ項目のうち、サーバーが許した項目だけを残す（順番は REVEAL_KEYS の順） */
export function resolveReveal(requested: readonly string[], allowed: readonly RevealKey[]): RevealKey[] {
  return REVEAL_KEYS.filter((k) => requested.includes(k) && allowed.includes(k))
}

/** 本人に許す項目。会社名はいつも、顧客名・金額・社員名は会社の管理者のときだけ */
export function allowedReveal(input: { isOrgAdmin: boolean }): RevealKey[] {
  return input.isOrgAdmin ? [...REVEAL_KEYS] : REVEAL_KEYS.filter((k) => !SENSITIVE_REVEAL.includes(k))
}

// ---- 期間（JST）----

const JST = 9 * 3600_000

export function jstYear(d: Date): number {
  return new Date(d.getTime() + JST).getUTCFullYear()
}

/** その年の JST 1月1日0時から、次の年の1月1日0時まで（UTC の Date。終わりは含まない） */
export function yearRange(year: number): { start: Date; end: Date } {
  return { start: new Date(Date.UTC(year, 0, 1) - JST), end: new Date(Date.UTC(year + 1, 0, 1) - JST) }
}

/** JST の月（0〜11）。範囲の外・読めない日時は -1 */
export function jstMonthIndex(at: Date | string | number, year: number): number {
  const t = at instanceof Date ? at.getTime() : new Date(at).getTime()
  if (!Number.isFinite(t)) return -1
  const j = new Date(t + JST)
  return j.getUTCFullYear() === year ? j.getUTCMonth() : -1
}

// ---- 集計 ----

/** DB から読んだもの（load.server.ts が作る。テストでは見本を渡す） */
export interface AnnualRawData {
  /** 本人の会社の名前（登録した会社。無ければ null） */
  companyName: string | null
  /** ツールごとの、作った日時の一覧（その年の分） */
  events: Partial<Record<AnnualToolId, (Date | string)[]>>
  /** 許したときだけ入る。見積（確定・送付済み、税抜）と受注の合計（円） */
  amounts?: { quoted: number; won: number }
  /** 許したときだけ入る。取引先の名前（記録1件ごとに1つ。多い順に上位を出す） */
  customers?: string[]
  /** 許したときだけ入る。担当した人の名前（記録1件ごとに1つ） */
  members?: string[]
}

export interface AnnualToolResult {
  id: AnnualToolId
  label: string
  unit: string
  count: number
  minutesSaved: number
}

export interface AnnualReport {
  year: number
  /** reveal に company があるときだけ */
  companyName: string | null
  totalItems: number
  /** 節約できた時間の目安（時間。整数に丸める） */
  hoursSaved: number
  /** 1日8時間として、何日分か（小数1桁） */
  workdaysSaved: number
  /** 件数の多い順。0件のツールは入れない */
  tools: AnnualToolResult[]
  /** 月ごとの件数（1月〜12月） */
  monthly: number[]
  /** いちばん多く作った月（1〜12）。記録が無ければ null */
  busiestMonth: number | null
  /** 1件以上作った月の数 */
  activeMonths: number
  amounts: { quoted: number; won: number } | null
  customers: string[] | null
  members: string[] | null
  /** 実際に画像に入れた項目 */
  revealed: RevealKey[]
}

const NAME_MAX = 20
const TOP_NAMES = 3

/** 画像に入れる名前を整える（制御文字を除き、長いものは切る） */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!v) return null
  return v.length > NAME_MAX ? `${v.slice(0, NAME_MAX - 1)}…` : v
}

/** 多い順の上位（同じ数なら先に出たもの） */
export function topNames(names: readonly unknown[] | undefined, n: number = TOP_NAMES): string[] {
  const counts = new Map<string, number>()
  for (const raw of names ?? []) {
    const v = cleanName(raw)
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name]) => name)
}

function safeAmount(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

export function buildAnnualReport(raw: AnnualRawData, opts: { year: number; reveal: readonly RevealKey[] }): AnnualReport {
  const { year } = opts
  const reveal = REVEAL_KEYS.filter((k) => opts.reveal.includes(k))
  const monthly = Array.from({ length: 12 }, () => 0)
  const tools: AnnualToolResult[] = []
  let totalMinutes = 0

  for (const tool of ANNUAL_TOOLS) {
    let count = 0
    for (const at of raw.events[tool.id] ?? []) {
      const m = jstMonthIndex(at, year)
      if (m < 0) continue
      monthly[m]++
      count++
    }
    if (count === 0) continue
    const minutesSaved = count * tool.minutesPerItem
    totalMinutes += minutesSaved
    tools.push({ id: tool.id, label: tool.label, unit: tool.unit, count, minutesSaved })
  }
  tools.sort((a, b) => b.count - a.count || b.minutesSaved - a.minutesSaved)

  const totalItems = tools.reduce((s, t) => s + t.count, 0)
  let busiestMonth: number | null = null
  monthly.forEach((c, i) => {
    if (c > 0 && (busiestMonth === null || c > monthly[busiestMonth - 1])) busiestMonth = i + 1
  })
  const hoursSaved = Math.round(totalMinutes / 60)

  const amounts = reveal.includes('amounts') && raw.amounts
    ? { quoted: safeAmount(raw.amounts.quoted), won: safeAmount(raw.amounts.won) }
    : null
  const customers = reveal.includes('customers') ? topNames(raw.customers) : null
  const members = reveal.includes('members') ? topNames(raw.members) : null
  const companyName = reveal.includes('company') ? cleanName(raw.companyName) : null

  return {
    year,
    companyName,
    totalItems,
    hoursSaved,
    workdaysSaved: Math.round((totalMinutes / 60 / 8) * 10) / 10,
    tools,
    monthly,
    busiestMonth,
    activeMonths: monthly.filter((c) => c > 0).length,
    amounts: amounts && (amounts.quoted > 0 || amounts.won > 0) ? amounts : null,
    customers: customers && customers.length ? customers : null,
    members: members && members.length ? members : null,
    revealed: reveal.filter((k) =>
      k === 'company' ? companyName !== null
        : k === 'amounts' ? amounts !== null && (amounts.quoted > 0 || amounts.won > 0)
        : k === 'customers' ? !!customers?.length
        : !!members?.length),
  }
}

export function toolLabel(id: AnnualToolId): string {
  return TOOL_BY_ID.get(id)?.label ?? id
}

/** 円の表示（1万円以上は「万円」） */
export function formatYen(n: number): string {
  if (n >= 100_000_000) return `${(Math.round(n / 10_000_000) / 10).toLocaleString('ja-JP')}億円`
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString('ja-JP')}万円`
  return `${n.toLocaleString('ja-JP')}円`
}
