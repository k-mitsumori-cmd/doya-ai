// ============================================
// 依頼の文に書かれている値だけを残す（AI の読み取りを、文と突き合わせて確かめる）
// ============================================
// 決まり: 欄に入れる値は、依頼の文から確かめられた値だけ。文に無い値は捨てて、あとで聞き返す。
//   - 金額（yen）: 文の中の数字（100万円・1,000,000円・1億・1億2,000万円 など）と同じ金額のときだけ
//   - 文字（text / longtext）: 文の中にある部分文字列のときだけ（空白と全角・半角をそろえて比べる）
//   - 日付（date）: 文に日付の言葉があるときだけ
//   - URL・メール: 文の中にあるときだけ
import { normalizeValue } from '@/lib/agent-router/prefill'
import type { AgentField } from '@/lib/agent-router/types'

/** 比べるための形（全角・半角をそろえ、空白を除き、英字は小文字にする） */
function fold(s: string): string {
  return s.normalize('NFKC').replace(/[\s​]+/g, '').toLowerCase()
}

const UNIT: Record<string, number> = { 億: 1e8, 万: 1e4, 千: 1e3, 百: 1e2 }
// 「100万円」「1億2,000万円」「5千円」「1,000,000円」「¥1000000」のような金額の並び
const AMOUNT_RUN = /([¥￥])?((?:\d+(?:\.\d+)?(?:億|万|千|百)?)+)(円)?/g
// 数のあとにこれが続くときは、金額ではない（2026年・11月・3人・2026-11-05 など）
const NOT_MONEY_AFTER = /^([年月日時分秒%個件名人社回週]|[-/.]\d)/

/** 文の中の金額の候補（円の整数）。「円」「¥」「万・億・千・百」があるか、1,000 以上の数のときだけ数える */
export function yenCandidates(text: string): Set<number> {
  const t = text.normalize('NFKC').replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
  const out = new Set<number>()
  for (const m of t.matchAll(AMOUNT_RUN)) {
    const run = m[2]
    const after = t.slice((m.index ?? 0) + m[0].length)
    let sum = 0
    for (const tok of run.matchAll(/(\d+(?:\.\d+)?)(億|万|千|百)?/g)) sum += parseFloat(tok[1]) * (tok[2] ? UNIT[tok[2]] : 1)
    const n = Math.round(sum)
    if (!Number.isSafeInteger(n) || n <= 0) continue
    const marked = Boolean(m[1] || m[3])
    if (!marked && NOT_MONEY_AFTER.test(after)) continue
    if (!marked && !/[億万千百]/.test(run) && n < 1000) continue
    out.add(n)
  }
  return out
}

const DATE_WORD = /(今日|本日|明日|明後日|昨日|一昨日|今週|来週|先週|今月|来月|先月|再来月|月初|月末|週明け|\d{4}[-/.年]\d{1,2}|\d{1,2}月|\d{1,2}日|[月火水木金土日]曜|来年|今年|年内|年度)/

function groundOne(field: Pick<AgentField, 'type'>, text: string, value: string): boolean {
  const ft = fold(text)
  switch (field.type) {
    case 'yen': return yenCandidates(text).has(Number(value))
    case 'number': return new RegExp(`(^|[^\\d.])${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\d]|$)`).test(text.normalize('NFKC').replace(/,/g, ''))
    case 'date': return DATE_WORD.test(text.normalize('NFKC'))
    case 'url': {
      try {
        const host = new URL(value).hostname.replace(/^www\./, '').toLowerCase()
        return ft.includes(host)
      } catch { return false }
    }
    case 'email': return ft.includes(fold(value))
    case 'text':
    case 'longtext':
    default: {
      const v = fold(value)
      return v.length > 0 && ft.includes(v)
    }
  }
}

/**
 * AI が読み取った値のうち、依頼の文で確かめられたものだけを残す。
 * 欄にない名前の値・形が合わない値・文に無い値は捨てる（dropped に名前を返す。呼ぶ側は足りない欄として聞き返す）。
 */
export function groundValues(
  text: string,
  values: Record<string, string> | null | undefined,
  fields: Pick<AgentField, 'key' | 'type'>[],
): { values: Record<string, string>; dropped: string[] } {
  const kept: Record<string, string> = {}
  const dropped: string[] = []
  for (const [key, raw] of Object.entries(values ?? {})) {
    const field = fields.find((f) => f.key === key)
    if (!field) { dropped.push(key); continue }
    const v = normalizeValue(field.type, raw)
    if (v && groundOne(field, text, v)) kept[key] = v
    else dropped.push(key)
  }
  return { values: kept, dropped }
}
