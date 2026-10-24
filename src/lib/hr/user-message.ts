// ============================================
// 人事: 画面に出すエラーの文を決める
// ============================================
// ⚠️ サーバーの応答の本文・e.message をそのまま出さない。
//    日本語の利用者向けの文だけを通し、英語や内部の言葉（API・Error・500 など）が混じるときは定型の文に置き換える。

const JAPANESE = /[぀-ヿ㐀-鿿]/
const INTERNAL = /(Error|error|undefined|null|NaN|Prisma|Supabase|Stripe|API|\bjob\b|ジョブ|stack|\b[45]\d\d\b|Failed|failed|Invalid|invalid)/

/** 利用者に見せてよい日本語の文なら返し、そうでなければ fallback を返す */
export function hrUserMessage(value: unknown, fallback: string): string {
  const text = value instanceof Error ? value.message : value
  if (typeof text !== 'string') return fallback
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 200 || !JAPANESE.test(trimmed) || INTERNAL.test(trimmed)) return fallback
  return trimmed
}
