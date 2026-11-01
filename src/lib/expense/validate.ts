// ============================================
// ドヤ支出管理: 入力の検証（API 共通）
// ============================================
// ⚠️ 受け取った値はここで型と範囲を確かめてから DB に渡す。失敗は 400 で理由を返す。
import { ExpenseHttpError } from './access'
import { isYm, isYmd, type Ym, type Ymd } from './dates'

const bad = (msg: string): never => {
  throw new ExpenseHttpError(400, msg)
}

export function str(v: unknown, label: string, max: number, required = true): string | null {
  if (v === undefined || v === null || v === '') return required ? bad(`${label}を入力してください`) : null
  if (typeof v !== 'string') return bad(`${label}の形式が正しくありません`)
  const s = v.trim()
  if (!s) return required ? bad(`${label}を入力してください`) : null
  if (s.length > max) return bad(`${label}は${max}文字以内で入力してください`)
  return s
}

export function int(v: unknown, label: string, min: number, max: number, required = true): number | null {
  if (v === undefined || v === null || v === '') return required ? bad(`${label}を入力してください`) : null
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n)) return bad(`${label}は整数で入力してください`)
  if (n < min || n > max) return bad(`${label}は${min}〜${max}の範囲で入力してください`)
  return n
}

export function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback
}

export function oneOf<T extends string | number>(v: unknown, options: readonly T[], label: string, fallback?: T): T {
  if ((v === undefined || v === null || v === '') && fallback !== undefined) return fallback
  if (!(options as readonly unknown[]).includes(v)) return bad(`${label}の値が正しくありません`)
  return v as T
}

export function date(v: unknown, label: string, required = true): Ymd | null {
  if (v === undefined || v === null || v === '') return required ? bad(`${label}を入力してください`) : null
  if (!isYmd(v)) return bad(`${label}は YYYY-MM-DD の形式で入力してください`)
  return v
}

export function month(v: unknown, label: string): Ym {
  if (!isYm(v)) return bad(`${label}は YYYY-MM の形式で指定してください`)
  return v
}

export function id(v: unknown, label: string, required = true): string | null {
  if (v === undefined || v === null || v === '') return required ? bad(`${label}を指定してください`) : null
  if (typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(v)) return bad(`${label}の形式が正しくありません`)
  return v
}

/** 1〜31 の日指定（31 = 月末） */
export const day = (v: unknown, label: string, required = true) => int(v, label, 1, 31, required)

/** 金額（円・セント）。10 億未満 */
export const money = (v: unknown, label: string, required = true) => int(v, label, 0, 999_999_999, required)

/** インボイス登録番号（T + 13 桁） */
export function invoiceRegNo(v: unknown): string | null {
  const s = str(v, '登録番号', 20, false)
  if (s === null) return null
  const normalized = s.toUpperCase().replace(/[\s-]/g, '')
  if (!/^T\d{13}$/.test(normalized)) return bad('登録番号は T から始まる14文字で入力してください')
  return normalized
}

/** Slack の Incoming Webhook URL だけを許す（任意の URL に送らせない） */
export function slackWebhook(v: unknown): string | null {
  const s = str(v, 'Slack の通知先', 300, false)
  if (s === null) return null
  if (!/^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/.test(s)) return bad('Slack の Incoming Webhook URL（https://hooks.slack.com/services/...）を入力してください')
  return s
}
