// ============================================
// ドヤ収入管理: 入力の検証（API 共通）
// ============================================
import { IncomeError } from './access'
import { isYmd, isValidPaymentTerms, MONTH_END, type Ymd } from './dates'
import { isTaxRate, MAX_YEN } from './tax'

type Body = Record<string, unknown>

export function asBody(value: unknown): Body {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new IncomeError('リクエストの形式が正しくありません')
  return value as Body
}

export function str(body: Body, key: string, label: string, opts: { required?: boolean; max?: number } = {}): string | null {
  const v = body[key]
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
    if (opts.required) throw new IncomeError(`${label}を入力してください`)
    return null
  }
  if (typeof v !== 'string') throw new IncomeError(`${label}の形式が正しくありません`)
  const s = v.trim()
  if (s.length > (opts.max ?? 200)) throw new IncomeError(`${label}は${opts.max ?? 200}文字以内で入力してください`)
  return s
}

export function reqStr(body: Body, key: string, label: string, max?: number): string {
  return str(body, key, label, { required: true, max })!
}

export function int(body: Body, key: string, label: string, opts: { required?: boolean; min?: number; max?: number } = {}): number | null {
  const v = body[key]
  if (v === undefined || v === null || v === '') {
    if (opts.required) throw new IncomeError(`${label}を入力してください`)
    return null
  }
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : v
  if (typeof n !== 'number' || !Number.isSafeInteger(n)) throw new IncomeError(`${label}は整数で入力してください`)
  const min = opts.min ?? 0
  const max = opts.max ?? MAX_YEN
  if (n < min || n > max) throw new IncomeError(`${label}は${min.toLocaleString('ja-JP')}〜${max.toLocaleString('ja-JP')}の範囲で入力してください`)
  return n
}

export function reqInt(body: Body, key: string, label: string, opts: { min?: number; max?: number } = {}): number {
  return int(body, key, label, { ...opts, required: true })!
}

export function date(body: Body, key: string, label: string, required = false): Ymd | null {
  const v = body[key]
  if (v === undefined || v === null || v === '') {
    if (required) throw new IncomeError(`${label}を入力してください`)
    return null
  }
  if (!isYmd(v)) throw new IncomeError(`${label}の日付が正しくありません`)
  return v
}

export function oneOf<T extends string>(body: Body, key: string, label: string, values: readonly T[], fallback: T): T {
  const v = body[key]
  if (v === undefined || v === null || v === '') return fallback
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) throw new IncomeError(`${label}の値が正しくありません`)
  return v as T
}

export function bool(body: Body, key: string, fallback = false): boolean {
  const v = body[key]
  if (v === undefined || v === null) return fallback
  if (typeof v !== 'boolean') throw new IncomeError(`${key} の形式が正しくありません`)
  return v
}

export function email(body: Body, key: string, label: string): string | null {
  const s = str(body, key, label, { max: 254 })
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new IncomeError(`${label}の形式が正しくありません`)
  return s
}

export type LineBody = { name: string; quantity: number; unitPrice: number; taxRate: number }

export function lines(body: Body, key: string, opts: { allowNegative?: boolean } = {}): LineBody[] {
  const raw = body[key]
  if (!Array.isArray(raw) || raw.length === 0) throw new IncomeError('明細を 1 行以上入力してください')
  if (raw.length > 100) throw new IncomeError('明細は 100 行までです')
  return raw.map((r, i) => {
    const row = asBody(r)
    const label = `${i + 1}行目`
    const taxRate = reqInt(row, 'taxRate', `${label}の税率`, { min: 0, max: 10 })
    if (!isTaxRate(taxRate)) throw new IncomeError(`${label}の税率は 10% / 8% / 0% のいずれかです`)
    return {
      name: reqStr(row, 'name', `${label}の品目`, 120),
      quantity: reqInt(row, 'quantity', `${label}の数量`, { min: 1, max: 100_000 }),
      unitPrice: reqInt(row, 'unitPrice', `${label}の単価`, { min: opts.allowNegative ? -MAX_YEN : 0 }),
      taxRate,
    }
  })
}

export function paymentTerms(body: Body) {
  const closingDay = int(body, 'closingDay', '締め日', { min: 1, max: MONTH_END })
  const paymentMonths = int(body, 'paymentMonths', '支払月', { min: 0, max: 6 })
  const paymentDay = int(body, 'paymentDay', '支払日', { min: 1, max: MONTH_END })
  const given = [closingDay, paymentMonths, paymentDay].filter((v) => v !== null).length
  if (given !== 0 && given !== 3) throw new IncomeError('締め日・支払月・支払日はまとめて指定してください')
  if (given === 3 && !isValidPaymentTerms({ closingDay: closingDay!, paymentMonths: paymentMonths!, paymentDay: paymentDay! })) throw new IncomeError('支払条件が正しくありません')
  return { closingDay, paymentMonths, paymentDay }
}

/** 振込名義は全角カタカナに寄せて保存（照合用） */
export function kana(body: Body, key: string, label: string): string | null {
  const s = str(body, key, label, { max: 100 })
  return s ? s.normalize('NFKC') : null
}

/** 請求書の下書き入力。明細に scheduleId（売上予定）を付けられる */
export function invoiceDraft(raw: unknown) {
  const body = asBody(raw)
  const ls = lines(body, 'lines', { allowNegative: true })
  const rawLines = body.lines as Body[]
  const issueDate = date(body, 'issueDate', '請求日', true)!
  return {
    clientId: reqStr(body, 'clientId', '取引先', 64),
    title: str(body, 'title', '件名', { max: 120 }),
    issueDate,
    dueDate: date(body, 'dueDate', '支払期日'),
    notes: str(body, 'notes', '備考', { max: 1000 }),
    lines: ls.map((l, i) => ({ ...l, scheduleId: str(asBody(rawLines[i]), 'scheduleId', '売上予定', { max: 64 }) })),
  }
}
