// ============================================
// interview の画面に出すエラーの文（UX 点検 FIX-PLAN 17）
// ============================================
// 例外の文・サーバーの応答の本文には、英語の文や内部の言葉（API・状態コードなど）が混ざる。
// 画面にはそのまま出さず、日本語の利用者向けの文だけを出す。そうでなければ決まった文（fallback）にする。

const JAPANESE = /[぀-ヿ一-鿿]/
// 利用者に見せない内部の言葉。どれかを含む文は決まった文に置き換える
const INTERNAL = /(API|Error|error|HTTP|status|undefined|null|JSON|fetch|Prisma|Gemini|OpenAI|AssemblyAI|Supabase|stack|\b[45]\d\d\b)/

/** 画面に出してよい文ならその文を、そうでなければ fallback を返す */
export function interviewUserMessage(message: unknown, fallback: string): string {
  const text = typeof message === 'string' ? message : message instanceof Error ? message.message : ''
  const t = text.trim()
  if (!t || !JAPANESE.test(t) || INTERNAL.test(t) || t.length > 120) return fallback
  return t
}
