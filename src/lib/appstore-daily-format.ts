// ============================================
// App Store 日次レポートの「わかりやすい」メッセージ整形（呪い日記 / ゆるせん 共通）
//
// ねらい: 毎朝Slackに届く数字を、ひと目で「昨日どうだったか」が分かる形にする。
// - 先頭に平易な「ひとことまとめ」（前日比つきの日本語文）
// - ダウンロード / 売上 を前日と並べて増減を明示
// - 末尾に用語の説明コメント（税込・手取り・集計タイミング）
// ============================================

import { convertToJpy, type SalesAggregate } from '@/lib/appstore-sales-core'

export type DailyStats = {
  downloads: number
  purchaseUnits: number
  grossJpy: number // 税込（ユーザー支払額）を円換算した合計
  proceedsJpy: number // 手取り（Apple手数料差引後）を円換算した合計
  unitsBySku: Map<string, number>
  /** レート未取得で円換算に含められなかった通貨（注記用） */
  unconverted: Map<string, number>
}

/** 全項目0の DailyStats（データ無しの日・前日不明時の既定値） */
export function zeroDailyStats(): DailyStats {
  return {
    downloads: 0,
    purchaseUnits: 0,
    grossJpy: 0,
    proceedsJpy: 0,
    unitsBySku: new Map(),
    unconverted: new Map(),
  }
}

/** 通貨別の集計を円換算し、メッセージ整形用の DailyStats に変換する（呪い日記/ゆるせん共通） */
export async function aggregateToDailyStats(agg: SalesAggregate): Promise<DailyStats> {
  const gross = await convertToJpy(agg.grossByCurrency)
  const proceeds = await convertToJpy(agg.proceedsByCurrency)
  const unconverted = new Map<string, number>()
  for (const [c, v] of gross.unconverted) unconverted.set(c, (unconverted.get(c) || 0) + v)
  for (const [c, v] of proceeds.unconverted) unconverted.set(c, (unconverted.get(c) || 0) + v)
  return {
    downloads: agg.downloads,
    purchaseUnits: agg.purchaseUnits,
    grossJpy: Math.round(gross.jpyTotal),
    proceedsJpy: Math.round(proceeds.jpyTotal),
    unitsBySku: agg.unitsBySku,
    unconverted,
  }
}

export type BuildDailyMessageOptions = {
  /** アプリ表示名（例: 「呪い日記」） */
  appLabel: string
  /** レポート対象日 YYYY-MM-DD（＝「きのう」にあたる確定日） */
  reportDate: string
  today: DailyStats
  /** 前日の集計（取得できなければ null → 前日比を省略） */
  prev: DailyStats | null
  /** 前日の日付 YYYY-MM-DD（prev があるときのみ意味を持つ） */
  prevDate: string | null
  /** SKU → 表示名の変換（未指定なら SKU 末尾を表示） */
  skuLabel?: (sku: string) => string
  /** データがそもそも取得できなかった（Apple集計待ち等）場合の注記を出す */
  noData?: boolean
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** YYYY-MM-DD → 「7/13(日)」 */
function fmtMD(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${m}/${d}(${wd})`
}

function fmtYen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}

/** 整数の増減を「+3」「-2」「±0」で表す */
function deltaInt(diff: number): string {
  if (diff > 0) return `+${fmtInt(diff)}`
  if (diff < 0) return `-${fmtInt(-diff)}`
  return '±0'
}

/** 金額の増減を「+¥600」「-¥300」「±¥0」で表す */
function deltaYen(diff: number): string {
  if (diff > 0) return `+${fmtYen(diff)}`
  if (diff < 0) return `-${fmtYen(-diff)}`
  return '±¥0'
}

function defaultSkuLabel(sku: string): string {
  return sku.split('.').pop() || sku
}

/** 「増えています／減っています／横ばいです」の判定（DLと売上の合議） */
function trendPhrase(dlDiff: number, grossDiff: number): string {
  const up = (dlDiff > 0 ? 1 : 0) + (grossDiff > 0 ? 1 : 0)
  const down = (dlDiff < 0 ? 1 : 0) + (grossDiff < 0 ? 1 : 0)
  if (up > 0 && down === 0) return '前日より増えています。'
  if (down > 0 && up === 0) return '前日より減っています。'
  if (up === 0 && down === 0) return '前日と同水準です。'
  return '前日と比べてまちまちです。'
}

/**
 * 日次レポートのSlackメッセージ（プレーンテキスト・日本語・絵文字なし）を組み立てる。
 */
export function buildDailyMessage(opts: BuildDailyMessageOptions): string {
  const { appLabel, reportDate, today, prev, prevDate, noData } = opts
  const skuLabel = opts.skuLabel ?? defaultSkuLabel
  const L: string[] = []

  L.push(`【${appLabel}】きのうの数値　${fmtMD(reportDate)}`)
  L.push('')

  // ---- ひとことまとめ ----
  L.push('■ ひとことまとめ')
  if (noData || (today.downloads === 0 && today.grossJpy === 0 && today.purchaseUnits === 0)) {
    L.push('きのうは 新規ダウンロード・売上ともにありませんでした。')
  } else {
    L.push(
      `きのうは ダウンロード${fmtInt(today.downloads)}件・売上${fmtYen(today.grossJpy)}` +
        `（手取り${fmtYen(today.proceedsJpy)}）でした。`,
    )
  }
  if (prev) {
    const dlDiff = today.downloads - prev.downloads
    const grossDiff = today.grossJpy - prev.grossJpy
    L.push(
      `前日（${fmtMD(prevDate as string)}）と比べて、ダウンロード ${deltaInt(dlDiff)}件・` +
        `売上 ${deltaYen(grossDiff)}。${trendPhrase(dlDiff, grossDiff)}`,
    )
  } else {
    L.push('（前日分が取得できなかったため、今回は前日比を省略しています。）')
  }
  L.push('')

  // ---- ダウンロード ----
  L.push('■ ダウンロード（新規インストール）')
  if (prev) {
    const dlDiff = today.downloads - prev.downloads
    L.push(`　${fmtInt(today.downloads)}件　（前日 ${fmtInt(prev.downloads)}件 → ${deltaInt(dlDiff)}）`)
  } else {
    L.push(`　${fmtInt(today.downloads)}件`)
  }
  L.push('')

  // ---- 売上 ----
  L.push('■ 売上')
  if (prev) {
    const grossDiff = today.grossJpy - prev.grossJpy
    L.push(
      `　税込（ユーザー支払額）　${fmtYen(today.grossJpy)}　（前日 ${fmtYen(prev.grossJpy)} → ${deltaYen(grossDiff)}）`,
    )
  } else {
    L.push(`　税込（ユーザー支払額）　${fmtYen(today.grossJpy)}`)
  }
  L.push(`　手取り（Apple手数料差引後）　${fmtYen(today.proceedsJpy)}`)
  L.push(`　購入件数　${fmtInt(today.purchaseUnits)}件`)
  if (today.unitsBySku.size > 0) {
    const items = [...today.unitsBySku.entries()].sort((a, b) => b[1] - a[1])
    for (const [sku, units] of items) {
      L.push(`　　・${skuLabel(sku)} ×${fmtInt(units)}`)
    }
  }
  L.push('')

  // ---- 用語・注記 ----
  L.push('────────────────')
  L.push('・数値は App Store Connect の前日確定分です（前日ぶんが翌朝に確定します）。')
  L.push('・「税込」＝ユーザーが実際に支払った額 ／「手取り」＝Apple手数料を引いた入金額。')
  L.push('・外貨の売上は当日レートで円換算しています。')
  if (noData) {
    L.push('・きのうの確定データがまだ生成されていない可能性があります（Apple側の集計待ち）。')
  }
  const unconvertedNote = buildUnconvertedNote(today.unconverted)
  if (unconvertedNote) L.push(unconvertedNote)

  return L.join('\n')
}

function buildUnconvertedNote(unconverted: Map<string, number>): string {
  if (unconverted.size === 0) return ''
  const currencies = [...unconverted.keys()].join('/')
  return `・${currencies} はレート未取得のため円換算に含めていません。`
}
