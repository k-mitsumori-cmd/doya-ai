// 日次コストレポートの型と文面（DB・外部通信に触れない。テストできるよう daily-report.ts から分けた）
import { CONSUMPTION_TAX_RATE, USD_TO_JPY } from './unit-prices'

export type Basis = '実費' | '見積り' | '日割り' | '取得できない'

export type Line = {
  label: string
  /** 前日の円。取得できないときは null（0 円と区別する） */
  dayJpy: number | null
  /** 今月の累計の円 */
  monthJpy: number | null
  basis: Basis
  note?: string
}

export type RevenueBlock = {
  /** 税込の売上（返金を引いた後）。取得できないときは null */
  dayGross: number | null
  monthGross: number | null
  dayFee: number | null
  monthFee: number | null
  note?: string
}

export type AcquisitionBlock = {
  target: string
  paidDay: number
  paidMonth: number
  totalDay: number
  channelsDay: { name: string; sessions: number }[]
  note?: string
} | null

export type DailyCostReport = {
  dayLabel: string
  monthLabel: string
  dayOfMonth: number
  daysInMonth: number
  lines: Line[]
  revenue: RevenueBlock
  acquisition: AcquisitionBlock
  acquisitionNote?: string
  missingKeys: string[]
}

// ---------- 文面 ----------

const yen = (n: number) => `${n < 0 ? '-' : ''}${Math.abs(Math.round(n)).toLocaleString('ja-JP')}円`

/** 粗利の目安（税抜の売上 − Stripe 手数料 − 取れた費用）。取れていない費用は含まないので、実際より大きく見える */
export function grossProfit(gross: number | null, fee: number | null, costs: number): number | null {
  if (gross === null) return null
  const net = gross / (1 + CONSUMPTION_TAX_RATE)
  return net - (fee ?? 0) - costs
}

export function formatDailyCostReport(r: DailyCostReport): string {
  const out: string[] = []
  out.push(`日次コストと売上｜${r.dayLabel} 分（前日と、今月 ${r.monthLabel} の累計）`, '')

  out.push('■ 費用')
  let dayCost = 0
  let monthCost = 0
  for (const l of r.lines) {
    if (l.dayJpy === null) {
      out.push(`・${l.label}：取得できない（${l.note ?? '理由不明'}）`)
      continue
    }
    dayCost += l.dayJpy
    monthCost += l.monthJpy ?? 0
    out.push(`・${l.label}：前日 ${yen(l.dayJpy)}／今月 ${l.monthJpy === null ? '—' : yen(l.monthJpy)}（${l.basis}）${l.note ? `\n  ${l.note}` : ''}`)
  }
  const missingCount = r.lines.filter((l) => l.dayJpy === null).length
  out.push(`・取れた費用の合計：前日 ${yen(dayCost)}／今月 ${yen(monthCost)}${missingCount ? `（取得できない ${missingCount} 件は含まない）` : ''}`)
  if (r.dayOfMonth > 1) {
    out.push(`・このペースの月末見込み：${yen((monthCost / (r.dayOfMonth - 1)) * r.daysInMonth)}（今月の累計を経過日数で割った単純な計算）`)
  }

  out.push('', '■ 売上（Stripe）')
  const v = r.revenue
  if (v.dayGross === null) {
    out.push(`・取得できない（${v.note ?? '理由不明'}）`)
  } else {
    out.push(`・前日 ${yen(v.dayGross)}（税込・返金を引いた後）／今月 ${yen(v.monthGross ?? 0)}`)
    out.push(`・Stripe 手数料：前日 ${yen(v.dayFee ?? 0)}／今月 ${yen(v.monthFee ?? 0)}`)
  }

  out.push('', '■ 粗利の目安')
  const gd = grossProfit(v.dayGross, v.dayFee, dayCost)
  const gm = grossProfit(v.monthGross, v.monthFee, monthCost)
  if (gd === null || gm === null) {
    out.push('・売上が取得できないため出せない')
  } else {
    out.push(`・前日 ${yen(gd)}／今月 ${yen(gm)}`)
    out.push(`・計算：税抜の売上（税込 ÷ ${1 + CONSUMPTION_TAX_RATE}）− Stripe 手数料 − 上の「取れた費用の合計」。${missingCount ? '取得できない費用を含まないので、実際より多く見える。' : ''}`)
  }

  out.push('', '■ 広告・集客')
  if (r.acquisition) {
    const a = r.acquisition
    out.push(`・${a.target}：前日の訪問 ${a.totalDay.toLocaleString('ja-JP')}件のうち、広告の経由（Paid・Display など）は ${a.paidDay.toLocaleString('ja-JP')}件。今月の広告経由は ${a.paidMonth.toLocaleString('ja-JP')}件`)
    out.push(`・前日の流入元：${a.channelsDay.map((c) => `${c.name} ${c.sessions}`).join('／')}`)
  } else {
    out.push(`・取得できない（${r.acquisitionNote ?? '理由不明'}）`)
  }
  out.push('・広告費そのもの（Google 広告・Meta 広告）は取得できない。API の連携が未実装')
  out.push('・App Store の流入・順位は、別のレポート（appstore 系）で毎朝送っている')

  if (r.missingKeys.length) {
    out.push('', '■ 足りない設定（値は Vercel の環境変数に入れる）', `・${r.missingKeys.join('、')}`)
  }
  out.push('', `※ 円は 1ドル=${USD_TO_JPY}円で換算。「見積り」は使用量に単価を掛けた概算で、請求額とずれる。`)
  return out.join('\n')
}

