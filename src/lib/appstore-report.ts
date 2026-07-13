import { gunzipSync } from 'zlib'
import jwt from 'jsonwebtoken'

// ============================================
// 呪い日記 App Store 日次レポート（App Store Connect → Slack）
//
// 構成:
// 1) ダウンロード数（新規インストール）
// 2) 課金 — 売上（税込・ユーザー支払額）と手取り（Apple手数料差引後 proceeds）を両方
//    → いずれも円換算に統一（JPY以外は当日レートで換算）
// 3) 有料アイテム（IAP）ごとの内訳
//
// データの注意:
// - App Store Connect の Sales Report は日次で「前日ぶんが翌日以降」に確定する。
//   直近日は 404（データ未生成）になるため、offset 1→2→3 の順に最新の取得可能日を探す
// - 金額は customer price（税込）と developer proceeds（手取り）が別カラム。
//   通貨も「Customer Currency」と「Currency of Proceeds」で別管理されている
//
// 認証: App Store Connect API キー（ES256 JWT）
//   APPSTORE_KEY_ID / APPSTORE_ISSUER_ID / APPSTORE_PRIVATE_KEY(.p8) / APPSTORE_VENDOR_NUMBER
// 対象アプリ: APPSTORE_APP_ID（既定=呪い日記 ascAppId 6786964992）
// 通知先: SLACK_APPSTORE_WEBHOOK_URL
// ============================================

const ASC_API = 'https://api.appstoreconnect.apple.com/v1'
const FX_API = 'https://api.frankfurter.dev/v1/latest'

/** 呪い日記の ascAppId（eas.json submit.production.ios.ascAppId） */
const DEFAULT_APP_ID = '6786964992'

/** IAP 製品IDの末尾 → 日本語表示名（呪い日記 STORE.md 準拠）。未知のものは生SKU表示 */
const IAP_NAMES: Record<string, string> = {
  credits_small: '呪詛の小瓶',
  credits_medium: '呪詛の壺',
  credits_large: '呪詛の大甕',
  shinigami_pact: '呪詛の大釜',
}

function skuLabel(sku: string): string {
  const suffix = sku.split('.').pop() || sku
  return IAP_NAMES[suffix] ? `${IAP_NAMES[suffix]}` : sku
}

// ---------- 環境変数 ----------

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) throw new Error(`${name} が未設定です（App Store 日次レポート）`)
  return v.trim()
}

/** .env では p8 秘密鍵の改行が \n として入ることが多いので実改行に戻す */
function getPrivateKey(): string {
  const raw = requiredEnv('APPSTORE_PRIVATE_KEY')
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw
}

// ---------- 共通ユーティリティ ----------

/** JSTの現在時刻（UTCゲッターをJSTとして読む） */
function jstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

/** JSTで今日から offsetDays 日前の日付を YYYY-MM-DD で返す */
function jstDate(offsetDays: number): string {
  const d = jstNow()
  d.setUTCDate(d.getUTCDate() - offsetDays)
  return d.toISOString().slice(0, 10)
}

function fmtYen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}

// ---------- App Store Connect JWT ----------

function makeJwt(): string {
  const keyId = requiredEnv('APPSTORE_KEY_ID')
  const issuerId = requiredEnv('APPSTORE_ISSUER_ID')
  const privateKey = getPrivateKey()

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 20 * 60, // App Store Connect の上限は 20 分
    aud: 'appstoreconnect-v1',
  }
  return jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: keyId, typ: 'JWT' },
  })
}

// ---------- Sales Report 取得 ----------

/** 指定日の SALES/SUMMARY/DAILY レポート（gzip TSV）を取得。データ無しは null */
async function fetchSalesReport(token: string, reportDate: string): Promise<string | null> {
  const vendorNumber = requiredEnv('APPSTORE_VENDOR_NUMBER')
  const params = new URLSearchParams({
    'filter[frequency]': 'DAILY',
    'filter[reportType]': 'SALES',
    'filter[reportSubType]': 'SUMMARY',
    'filter[vendorNumber]': vendorNumber,
    'filter[reportDate]': reportDate,
  })
  const res = await fetch(`${ASC_API}/salesReports?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/a-gzip',
    },
  })

  // データがまだ生成されていない日は 404（"There were no sales..."）
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`App Store Connect API error ${res.status}: ${text.slice(0, 300)}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  return gunzipSync(buf).toString('utf8')
}

// ---------- TSV パース＆集計 ----------

type SalesRow = Record<string, string>

function parseTsv(tsv: string): SalesRow[] {
  const lines = tsv.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []
  const headers = lines[0].split('\t').map((h) => h.trim())
  const rows: SalesRow[] = []
  for (let i = 1; i < lines.length; i++) {
    // Apple のレポート末尾には "Total_..." のサマリ行が付くことがあるので除外
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

function num(v: string | undefined): number {
  const n = Number((v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

type Aggregated = {
  downloads: number
  purchaseUnits: number
  grossByCurrency: Map<string, number> // Customer Currency → 税込ユーザー支払額
  proceedsByCurrency: Map<string, number> // Currency of Proceeds → 手取り
  itemsBySku: Map<string, { units: number; grossJpyKnown: boolean }>
}

/**
 * 対象アプリのみに絞って集計。
 * - ダウンロード = アプリ本体の新規インストール（Product Type が IA*=アプリ内課金 でも 7*=アップデート でもない行）
 * - 売上 = 各行の Units × Customer Price（無料DL行は価格0なので自然に0）
 * - 手取り = 各行の Units × Developer Proceeds
 */
function aggregate(rows: SalesRow[], appId: string): Aggregated {
  const grossByCurrency = new Map<string, number>()
  const proceedsByCurrency = new Map<string, number>()
  const itemsBySku = new Map<string, { units: number; grossJpyKnown: boolean }>()
  let downloads = 0
  let purchaseUnits = 0

  for (const row of rows) {
    const rowAppId = row['Apple Identifier'] || ''
    // 対象アプリ以外（同一アカウントの別アプリ）は除外。IAP行の Apple Identifier は
    // 親アプリのIDが入るため、この判定でアプリ本体もIAPも同時に絞り込める
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

    // ダウンロード数（アプリ本体の新規インストール）
    if (!isInApp && !isUpdate) {
      downloads += units
    }

    // 売上（税込ユーザー支払額）
    if (customerPrice > 0) {
      grossByCurrency.set(
        customerCurrency,
        (grossByCurrency.get(customerCurrency) || 0) + customerPrice * units,
      )
    }
    // 手取り（Apple手数料差引後）
    if (proceeds > 0) {
      proceedsByCurrency.set(
        proceedsCurrency,
        (proceedsByCurrency.get(proceedsCurrency) || 0) + proceeds * units,
      )
      purchaseUnits += units
      const sku = row['SKU'] || row['Title'] || '(不明)'
      const cur = itemsBySku.get(sku) || { units: 0, grossJpyKnown: false }
      cur.units += units
      itemsBySku.set(sku, cur)
    }
  }

  return { downloads, purchaseUnits, grossByCurrency, proceedsByCurrency, itemsBySku }
}

// ---------- 為替換算（→ JPY） ----------

type JpyConversion = {
  jpyTotal: number
  unconverted: Map<string, number> // 換算できなかった通貨（レート未取得）
}

/** 通貨別の金額マップを JPY 合計に換算する。JPYはそのまま、他はFrankfurterのレートで換算 */
async function convertToJpy(byCurrency: Map<string, number>): Promise<JpyConversion> {
  let jpyTotal = byCurrency.get('JPY') || 0
  const unconverted = new Map<string, number>()

  const foreign = [...byCurrency.keys()].filter((c) => c !== 'JPY')
  if (foreign.length === 0) return { jpyTotal, unconverted }

  let rates: Record<string, number> = {}
  try {
    const url = `${FX_API}?base=JPY&symbols=${foreign.join(',')}`
    const res = await fetch(url)
    if (res.ok) {
      const json = (await res.json()) as { rates?: Record<string, number> }
      rates = json.rates || {}
    }
  } catch {
    // レート取得失敗時は下で unconverted に振り分ける
  }

  for (const cur of foreign) {
    const amount = byCurrency.get(cur) || 0
    const jpyPerForeign = rates[cur] // 1 JPY = jpyPerForeign [cur]
    if (jpyPerForeign && jpyPerForeign > 0) {
      jpyTotal += amount / jpyPerForeign
    } else {
      unconverted.set(cur, amount)
    }
  }
  return { jpyTotal, unconverted }
}

// ---------- Slack ----------

async function postSlack(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_APPSTORE_WEBHOOK_URL
  if (!webhookUrl) {
    throw new Error('SLACK_APPSTORE_WEBHOOK_URL is not set')
  }
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    throw new Error(`Slack webhook error: ${res.status} ${await res.text().catch(() => '')}`)
  }
}

function unconvertedNote(...maps: Map<string, number>[]): string {
  const currencies = new Set<string>()
  for (const m of maps) for (const c of m.keys()) currencies.add(c)
  if (currencies.size === 0) return ''
  return `\n※ ${[...currencies].join('/')} はレート未取得のため円換算に含めていません。`
}

// ---------- メイン ----------

export type AppStoreReportResult = {
  reportDate: string | null
  downloads: number
  grossJpy: number
  proceedsJpy: number
  purchaseUnits: number
}

/**
 * 直近の取得可能日（1〜3日前）の App Store 日次データを集計して Slack に通知する。
 * @param opts.date 明示日付（YYYY-MM-DD）。手動テスト用。未指定なら自動で最新日を探す
 */
export async function sendAppStoreReport(
  opts: { date?: string } = {},
): Promise<AppStoreReportResult> {
  const appId = (process.env.APPSTORE_APP_ID || DEFAULT_APP_ID).trim()
  const token = makeJwt()

  // 取得可能な最新日を探す（明示指定があればそれだけ）
  const candidates = opts.date ? [opts.date] : [jstDate(1), jstDate(2), jstDate(3)]
  let reportDate: string | null = null
  let tsv: string | null = null
  for (const d of candidates) {
    tsv = await fetchSalesReport(token, d)
    if (tsv) {
      reportDate = d
      break
    }
  }

  if (!tsv || !reportDate) {
    // 直近日ともデータ無し。App Store Connect は「その日の売上・DLが0件」のとき 404
    // （"There were no sales..."）を返すため、これは 0件 の正常応答として扱う。
    // ごく直近の日付はApple側の集計待ちで未生成のこともある。
    await postSlack(
      `呪い日記 App Store 日次レポート（${candidates[0]} 分）\n────────────────\nダウンロード: 0件\n売上: ¥0\n\n※ 直近（${candidates.join(' / ')}）に記録された売上・ダウンロードはありませんでした（Apple側の集計待ちの可能性もあります）。`,
    )
    return { reportDate: null, downloads: 0, grossJpy: 0, proceedsJpy: 0, purchaseUnits: 0 }
  }

  const agg = aggregate(parseTsv(tsv), appId)
  const gross = await convertToJpy(agg.grossByCurrency)
  const proceeds = await convertToJpy(agg.proceedsByCurrency)

  // ---- メッセージ整形（プレーンテキスト・日本語） ----
  const lines: string[] = []
  lines.push(`呪い日記 App Store 日次レポート（${reportDate} 分）`)
  lines.push('────────────────')
  lines.push(`ダウンロード: ${fmtInt(agg.downloads)}件（新規インストール）`)
  lines.push('')
  lines.push(`売上（税込・ユーザー支払額）: ${fmtYen(gross.jpyTotal)}`)
  lines.push(`手取り（Apple手数料差引後）: ${fmtYen(proceeds.jpyTotal)}`)
  lines.push(`購入件数: ${fmtInt(agg.purchaseUnits)}件`)

  if (agg.itemsBySku.size > 0) {
    const items = [...agg.itemsBySku.entries()].sort((a, b) => b[1].units - a[1].units)
    for (const [sku, info] of items) {
      lines.push(`　・${skuLabel(sku)} ×${fmtInt(info.units)}`)
    }
  }

  lines.push('')
  lines.push('※ 金額は円換算（当日レート）。JPY以外の売上は取得レートで換算しています。')
  const note = unconvertedNote(gross.unconverted, proceeds.unconverted)
  if (note) lines.push(note.trim())

  await postSlack(lines.join('\n'))

  return {
    reportDate,
    downloads: agg.downloads,
    grossJpy: Math.round(gross.jpyTotal),
    proceedsJpy: Math.round(proceeds.jpyTotal),
    purchaseUnits: agg.purchaseUnits,
  }
}
