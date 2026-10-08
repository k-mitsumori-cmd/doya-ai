// ============================================
// ドヤAI質問リンク: URLの組み立てと機械チェック
// ============================================
// ⚠️ 質問文は「ボタンを押した訪問者本人の発言」として ChatGPT に表示される。
//    指示書のような文面や、サイトに無いURLが混ざると訪問者の信頼を損なう。
// ⚠️ プロンプトで禁止しても守られる前提にしない（quote で、止めた数字をモデルが埋めた実績）。
//    ここの判定が最終の関門。生成側・編集側の両方から必ず通す。

/** 質問文の上限（文字数） */
export const QUESTION_MAX_CHARS = 450
/** エンコード後のURL全体の上限。日本語は1文字が約9文字に伸びるので文字数ではなくこちらで判定する */
export const URL_MAX_LENGTH = 4000
/** ボタン名の上限（文字数） */
export const BUTTON_LABEL_MAX_CHARS = 15

import type { AskLink, LinkKey } from './types'

const CHATGPT_BASE = 'https://chatgpt.com/?q='

/**
 * ChatGPT を開いて質問文を送るURL。
 * ⚠️ q / hints は OpenAI の公式仕様ではない。将来動かなくなる可能性がある（画面に注記する）。
 * ⚠️ 手書きのエンコードや文字列置換はしない。encodeURIComponent だけを使う。
 */
export function buildChatgptUrl(question: string): string {
  return CHATGPT_BASE + encodeURIComponent(question) + '&hints=search'
}

/** 文字数（サロゲートペアを1文字と数える） */
export function countChars(text: string): number {
  return Array.from(text).length
}

/** 文中のURLを取り出す。日本語の句読点・括弧で終わる */
export function extractUrls(text: string): string[] {
  const m = text.match(/https?:\/\/[^\s"'<>（）()「」『』【】、。，．！？]+/g)
  return (m || []).map((u) => u.replace(/[.,;:!?]+$/, ''))
}

/** 比較用にURLを正規化する（ホスト小文字・ハッシュ除去・末尾スラッシュ除去） */
export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const path = u.pathname.replace(/\/+$/, '')
    return `${host}${path}${u.search}`
  } catch {
    return null
  }
}

/** 禁止表現。見つかったら理由として返す */
const FORBIDDEN_PATTERNS: { re: RegExp; label: string }[] = [
  // 役割指定（文頭・行頭の「あなたは」）
  { re: /(^|[\n。！？!?]\s*)あなたは/, label: '「あなたは」で始まる役割指定' },
  { re: /しないで/, label: '「〜しないで」' },
  { re: /するな/, label: '「〜するな」' },
  { re: /禁止/, label: '「禁止」' },
  { re: /誘導/, label: '「誘導」' },
  { re: /案内役/, label: '「案内役」' },
  { re: /次の一手/, label: '「次の一手」' },
  { re: /CV|ＣＶ/i, label: '「CV」' },
]

export interface QuestionCheck {
  ok: boolean
  /** 不合格の理由（利用者に見せる文言） */
  issues: string[]
  chars: number
  urlLength: number
  /** 文中のURLのうち、サイト上で確認できなかったもの */
  unknownUrls: string[]
}

/**
 * 質問文の機械チェック。
 * @param allowedUrls サイトの読み取りで実際に見つかったURLの集合（4-1）
 */
export function checkQuestion(question: string, allowedUrls: string[]): QuestionCheck {
  const issues: string[] = []
  const text = question.trim()
  const chars = countChars(text)
  const urlLength = buildChatgptUrl(text).length

  if (!text) issues.push('質問文が空です')

  // utm_ はURLの中にも出るので、URLを除く前の全文で見る
  if (/utm_/i.test(text)) issues.push('「utm_」を含んでいます')

  // 「CV」などの語判定はURLの文字列に誤反応しないよう、URLを除いた本文で行う
  const urls = extractUrls(text)
  let body = text
  for (const u of urls) body = body.split(u).join(' ')
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.re.test(body)) issues.push(`使わない表現（${p.label}）を含んでいます`)
  }

  const allowed = new Set(allowedUrls.map(normalizeUrl).filter((u): u is string => !!u))
  const unknownUrls = urls.filter((u) => {
    const n = normalizeUrl(u)
    return !n || !allowed.has(n)
  })
  if (unknownUrls.length) issues.push(`サイト上で確認できないURLを含んでいます（${unknownUrls.join(' / ')}）`)

  if (chars > QUESTION_MAX_CHARS) issues.push(`${QUESTION_MAX_CHARS}字を超えています（${chars}字）`)
  if (urlLength > URL_MAX_LENGTH) issues.push(`URLが長すぎます（${urlLength}文字。上限${URL_MAX_LENGTH}文字）`)

  return { ok: issues.length === 0, issues, chars, urlLength, unknownUrls }
}

/** ボタン名のチェック（15字以内・禁止表現なし） */
export function checkButtonLabel(label: string): string[] {
  const issues: string[] = []
  const t = label.trim()
  if (!t) issues.push('ボタン名が空です')
  if (countChars(t) > BUTTON_LABEL_MAX_CHARS) issues.push(`ボタン名が${BUTTON_LABEL_MAX_CHARS}字を超えています`)
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.re.test(t)) issues.push(`ボタン名に使わない表現（${p.label}）を含んでいます`)
  }
  return issues
}

/** 質問文からリンクを組み立てて機械チェックする。画面での編集時もここを通す */
export function buildLink(key: LinkKey, title: string, buttonLabel: string, question: string, allowedUrls: string[]): AskLink {
  const q = question.trim()
  const check = checkQuestion(q, allowedUrls)
  const labelIssues = checkButtonLabel(buttonLabel)
  const merged = { ...check, issues: [...check.issues, ...labelIssues], ok: check.ok && labelIssues.length === 0 }
  return { key, title, buttonLabel: buttonLabel.trim(), question: q, url: buildChatgptUrl(q), check: merged, needsReview: !merged.ok }
}
