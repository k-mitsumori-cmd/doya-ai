// 画面に出すエラーの文を決める（UX 点検 FIX-PLAN 17）。
// サーバーが日本語の利用者向けの文を返したときだけそれを使い、英語・内部の言葉・空のときは決まった文にする。
const JA = /[぀-ヿ一-鿿]/
const INTERNAL = /(API|Prisma|digest|stack|undefined|Error:|(status|HTTP)\s*\d{3})/i

export const KINTAI_NETWORK_ERROR = '通信できませんでした。通信を確かめて、もう一度お試しください。'

export function userErrorMessage(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const t = raw.trim()
  if (!t || t.length > 120 || !JA.test(t) || INTERNAL.test(t)) return fallback
  return t
}
