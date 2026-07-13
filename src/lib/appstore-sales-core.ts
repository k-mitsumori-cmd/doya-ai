import { gunzipSync } from 'zlib'
import jwt from 'jsonwebtoken'

// ============================================
// App Store Connect Sales Report 共通コア
//
// 日次/週次/月次の各レポート（日次売上・国別・週次/月次まとめ）で共有する:
// - ES256 JWT 生成
// - Sales Report（DAILY/WEEKLY/MONTHLY）の取得・gzip解凍・TSVパース
// - 通貨別金額 → JPY 換算
//
// 認証: APPSTORE_KEY_ID / APPSTORE_ISSUER_ID / APPSTORE_PRIVATE_KEY / APPSTORE_VENDOR_NUMBER
// ============================================

const ASC_API = 'https://api.appstoreconnect.apple.com/v1'
const FX_API = 'https://api.frankfurter.dev/v1/latest'

/** 呪い日記の ascAppId（eas.json submit.production.ios.ascAppId） */
export const DEFAULT_APP_ID = '6786964992'

export type SalesFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type SalesRow = Record<string, string>

// ---------- 環境変数 ----------

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) throw new Error(`${name} が未設定です（App Store レポート）`)
  return v.trim()
}

function getPrivateKey(): string {
  const raw = requiredEnv('APPSTORE_PRIVATE_KEY')
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw
}

export function appStoreAppId(): string {
  return (process.env.APPSTORE_APP_ID || DEFAULT_APP_ID).trim()
}

// ---------- 日付（JST） ----------

export function jstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

/** JSTで今日から offsetDays 日前の日付を YYYY-MM-DD で返す */
export function jstDate(offsetDays: number): string {
  const d = jstNow()
  d.setUTCDate(d.getUTCDate() - offsetDays)
  return d.toISOString().slice(0, 10)
}

// ---------- JWT ----------

export function makeJwt(): string {
  const keyId = requiredEnv('APPSTORE_KEY_ID')
  const issuerId = requiredEnv('APPSTORE_ISSUER_ID')
  const privateKey = getPrivateKey()
  const now = Math.floor(Date.now() / 1000)
  const payload = { iss: issuerId, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1' }
  return jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: keyId, typ: 'JWT' },
  })
}

// ---------- Sales Report 取得 ----------

/** 指定頻度・日付の SALES/SUMMARY レポート（gzip TSV）を取得。データ無しは null */
export async function fetchSalesReport(
  token: string,
  reportDate: string,
  frequency: SalesFrequency = 'DAILY',
): Promise<string | null> {
  const vendorNumber = requiredEnv('APPSTORE_VENDOR_NUMBER')
  const params = new URLSearchParams({
    'filter[frequency]': frequency,
    'filter[reportType]': 'SALES',
    'filter[reportSubType]': 'SUMMARY',
    'filter[vendorNumber]': vendorNumber,
    'filter[reportDate]': reportDate,
  })
  const res = await fetch(`${ASC_API}/salesReports?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/a-gzip' },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`App Store Connect API error ${res.status}: ${text.slice(0, 300)}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  return gunzipSync(buf).toString('utf8')
}

export function parseTsv(tsv: string): SalesRow[] {
  const lines = tsv.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []
  const headers = lines[0].split('\t').map((h) => h.trim())
  const rows: SalesRow[] = []
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith('Total_')) continue
    const cols = lines[i].split('\t')
    const row: SalesRow = {}
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

export function num(v: string | undefined): number {
  const n = Number((v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * 直近の取得可能な日次レポートを 1→2→3 日前の順に探す。
 * 明示日付があればその1日だけ試す。
 */
export async function getLatestDailyRows(
  token: string,
  explicitDate?: string,
): Promise<{ reportDate: string; rows: SalesRow[] } | null> {
  const candidates = explicitDate ? [explicitDate] : [jstDate(1), jstDate(2), jstDate(3)]
  for (const d of candidates) {
    const tsv = await fetchSalesReport(token, d, 'DAILY')
    if (tsv) return { reportDate: d, rows: parseTsv(tsv) }
  }
  return null
}

// ---------- 為替換算（→ JPY） ----------

export type JpyConversion = {
  jpyTotal: number
  unconverted: Map<string, number>
}

/** 通貨別金額マップを JPY 合計に換算（JPYはそのまま、他はFrankfurterの当日レート） */
export async function convertToJpy(byCurrency: Map<string, number>): Promise<JpyConversion> {
  let jpyTotal = byCurrency.get('JPY') || 0
  const unconverted = new Map<string, number>()
  const foreign = [...byCurrency.keys()].filter((c) => c !== 'JPY')
  if (foreign.length === 0) return { jpyTotal, unconverted }

  let rates: Record<string, number> = {}
  try {
    const res = await fetch(`${FX_API}?base=JPY&symbols=${foreign.join(',')}`)
    if (res.ok) {
      const json = (await res.json()) as { rates?: Record<string, number> }
      rates = json.rates || {}
    }
  } catch {
    // 取得失敗時は下で unconverted に振り分け
  }
  for (const cur of foreign) {
    const amount = byCurrency.get(cur) || 0
    const jpyPerForeign = rates[cur]
    if (jpyPerForeign && jpyPerForeign > 0) jpyTotal += amount / jpyPerForeign
    else unconverted.set(cur, amount)
  }
  return { jpyTotal, unconverted }
}

// ---------- 集計（共通） ----------

export type SalesAggregate = {
  downloads: number
  purchaseUnits: number
  grossByCurrency: Map<string, number>
  proceedsByCurrency: Map<string, number>
}

/** 対象アプリのみ集計。ダウンロード=アプリ本体新規、売上=Units×価格、手取り=Units×proceeds */
export function aggregateSales(rows: SalesRow[], appId: string): SalesAggregate {
  const grossByCurrency = new Map<string, number>()
  const proceedsByCurrency = new Map<string, number>()
  let downloads = 0
  let purchaseUnits = 0
  for (const row of rows) {
    const rowAppId = row['Apple Identifier'] || ''
    if (appId && rowAppId && rowAppId !== appId) continue
    const units = num(row['Units'])
    if (units <= 0) continue
    const productType = (row['Product Type Identifier'] || '').toUpperCase()
    const isInApp = productType.startsWith('IA')
    const isUpdate = productType.startsWith('7')
    const customerPrice = num(row['Customer Price'])
    const proceeds = num(row['Developer Proceeds'])
    const customerCurrency = row['Customer Currency'] || 'JPY'
    const proceedsCurrency = row['Currency of Proceeds'] || 'JPY'
    if (!isInApp && !isUpdate) downloads += units
    if (customerPrice > 0) {
      grossByCurrency.set(
        customerCurrency,
        (grossByCurrency.get(customerCurrency) || 0) + customerPrice * units,
      )
    }
    if (proceeds > 0) {
      proceedsByCurrency.set(
        proceedsCurrency,
        (proceedsByCurrency.get(proceedsCurrency) || 0) + proceeds * units,
      )
      purchaseUnits += units
    }
  }
  return { downloads, purchaseUnits, grossByCurrency, proceedsByCurrency }
}
