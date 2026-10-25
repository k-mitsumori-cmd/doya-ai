// ============================================
// 運営に伝える: 受付番号・営業時間・伏せ字・Slack の文面（純粋な関数）
// ============================================
// Slack は共通の送り口（src/lib/slack/notify.ts 1.2.1）の決まりに合わせる。
// 種類は「お問い合わせ」、重さは rules.ts の severityOf()。絵文字は使わない。
// ⚠️ 利用者の書いた文は excerpt / escapeSlackText を通し、個人情報を伏せてから載せる。
import { escapeSlackText, maskEmail, redactSecrets, type SlackMeta } from '@/lib/slack/notify'
import { SUPPORT_CATEGORY_LABEL, severityOf, type SupportCategory } from './rules'
import type { ChatTurn } from './answer'

const JST_MS = 9 * 60 * 60 * 1000

/** 受付番号（例: DY-261026-4F7K）。日付は日本時間。末尾は紛らわしい文字（0/O/1/I）を使わない */
export function makeTicketNo(now = Date.now(), rand: () => number = Math.random): string {
  const d = new Date(now + JST_MS).toISOString()
  const ymd = `${d.slice(2, 4)}${d.slice(5, 7)}${d.slice(8, 10)}`
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let tail = ''
  for (let i = 0; i < 4; i++) tail += chars[Math.floor(rand() * chars.length) % chars.length]
  return `DY-${ymd}-${tail}`
}

/** 営業時間内か（平日 10〜18時、日本時間）。⚠️ 祝日はまだ見ていない（設計書 10） */
export function isBusinessHours(now = Date.now()): boolean {
  const d = new Date(now + JST_MS)
  const day = d.getUTCDay()
  const hour = d.getUTCHours()
  return day >= 1 && day <= 5 && hour >= 10 && hour < 18
}

/** 画面に出す返信の目安 */
export function replyEtaText(category: SupportCategory, now = Date.now()): string {
  if (category === 'security') return '担当者がすぐに確認します。'
  return isBusinessHours(now)
    ? '1営業日以内に、ログインに使っているメールアドレスへお返事します。'
    : '今は受付時間外です。次の営業日から順にお返事します（受付時間: 平日 10時〜18時）。'
}

/** 電話番号・カードらしい数字・メールアドレス・トークンを伏せる */
export function redactPersonal(text: string): string {
  let s = redactSecrets(text || '')
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => maskEmail(m))
  // カードの番号らしい 13〜19桁（区切りの空白・ハイフンを含む）
  s = s.replace(/(?:\d[ -]?){13,19}/g, '[カード番号らしき数字を伏せました]')
  // 電話番号（0 で始まる 10〜11桁。ハイフン区切りも）
  s = s.replace(/0\d{1,4}-?\d{1,4}-?\d{3,4}/g, (m) => (m.replace(/-/g, '').length >= 10 ? '[電話番号を伏せました]' : m))
  return s
}

export type TicketEnv = {
  userAgent?: string
  viewport?: string
  url?: string
  recentErrors?: string[]
}

export type TicketInput = {
  ticketNo: string
  category: SupportCategory
  message: string
  transcript: ChatTurn[]
  toolLabel: string
  pagePath: string
  companyName: string | null
  plan: string | null
  userEmail: string | null
  contactOk: boolean
  env: TicketEnv
}

/** 利用者の文を、Slack に載せられる形にする（伏せ字 → 差し込みの無効化 → 長さの上限） */
export function safeUserText(text: string, max: number): string {
  const s = escapeSlackText(redactPersonal(text).trim())
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/** やり取りの要約（直近6件、1件100字まで） */
export function summarizeTranscript(turns: ChatTurn[]): string[] {
  return turns.slice(-6).map((t) => `${t.role === 'user' ? '利用者' : 'AI'}: ${safeUserText(t.text.replace(/\s+/g, ' '), 100)}`)
}

/** 端末の情報を短くまとめる（伏せ字をかけ、エラーは最大5件） */
export function envLines(env: TicketEnv): string[] {
  const lines: string[] = []
  if (env.url) lines.push(`- URL: ${safeUserText(env.url.split('?')[0], 200)}`)
  if (env.viewport) lines.push(`- 画面の幅: ${safeUserText(env.viewport, 20)}`)
  if (env.userAgent) lines.push(`- ブラウザ: ${safeUserText(env.userAgent, 160)}`)
  const errs = (env.recentErrors ?? []).slice(-5)
  if (errs.length) {
    lines.push('- 直近のエラー:')
    for (const e of errs) lines.push(`  - ${safeUserText(e, 160)}`)
  }
  return lines
}

export function ticketMeta(category: SupportCategory): SlackMeta {
  return { app: 'ドヤAI', kind: 'inquiry', severity: severityOf(category) }
}

/** Slack に送る本文（見出しは共通の送り口がそろえる） */
export function buildTicketSlack(input: TicketInput, now = Date.now()): { title: string; text: string; meta: SlackMeta } {
  const label = SUPPORT_CATEGORY_LABEL[input.category]
  const title = `サポートチャット（${label}）受付 ${input.ticketNo}`
  const time = new Date(now).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  const lines = [
    `*${title}*`,
    `発生時刻：${time}（日本時間）`,
    `運営の対応が要るお問い合わせが届きました。${isBusinessHours(now) ? '今日中に確認してください。' : '受付時間外に届きました。次の営業日に確認してください。'}`,
    '',
    `- 受付番号: ${input.ticketNo}`,
    `- 分類: ${label}`,
    `- 会社: ${input.companyName ? safeUserText(input.companyName, 60) : '未登録'}`,
    `- プラン: ${input.plan || '不明'}`,
    `- ツール: ${input.toolLabel}`,
    `- 画面: ${safeUserText(input.pagePath.split('?')[0], 120)}`,
    `- 送信者: ${maskEmail(input.userEmail)}（返信は管理画面のサポートの受付から）`,
    `- 返信の連絡: ${input.contactOk ? 'ログインのメールに返してよい' : 'メールでの返信は希望しない'}`,
    '',
    '*お問い合わせの内容*',
    safeUserText(input.message, 1200),
  ]
  const summary = summarizeTranscript(input.transcript)
  if (summary.length) lines.push('', '*チャットのやり取り（直近）*', ...summary)
  const env = envLines(input.env)
  if (env.length) lines.push('', '*端末の情報*', ...env)
  lines.push('', `リンク: <https://doya-ai.surisuta.jp/admin/support?ticket=${encodeURIComponent(input.ticketNo)}|管理画面で受付を開く>`)
  return { title, text: lines.join('\n'), meta: ticketMeta(input.category) }
}

/** ServiceFeedback に残す本文（管理画面で読む。メールは伏せない＝返信に要るため、本文の外の userId で引く） */
export function buildStoredText(input: TicketInput): string {
  const label = SUPPORT_CATEGORY_LABEL[input.category]
  const parts = [
    `【サポートチャット・${label}】受付番号 ${input.ticketNo}`,
    `（${input.pagePath.split('?')[0].slice(0, 200)}／${input.toolLabel}）`,
    input.contactOk ? '返信: ログインのメールに返してよい' : '返信: メールでの返信は希望しない',
    '',
    redactPersonal(input.message).slice(0, 2000),
  ]
  const summary = summarizeTranscript(input.transcript)
  if (summary.length) parts.push('', '--- チャットのやり取り（直近） ---', ...summary)
  const env = envLines(input.env)
  if (env.length) parts.push('', '--- 端末の情報 ---', ...env)
  return parts.join('\n').slice(0, 4000)
}

/** 利用者が受付に追記したときの Slack の本文 */
export function buildFollowUpSlack(input: { ticketNo: string; category: SupportCategory; message: string }, now = Date.now()): { title: string; text: string; meta: SlackMeta } {
  const label = SUPPORT_CATEGORY_LABEL[input.category]
  const title = `サポートチャット（${label}）追記 ${input.ticketNo}`
  const time = new Date(now).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  const text = [
    `*${title}*`,
    `発生時刻：${time}（日本時間）`,
    'お客さまが受付に追記しました。内容を確認して、返信してください。',
    '',
    '*追記の内容*',
    safeUserText(input.message, 1200),
    '',
    `リンク: <https://doya-ai.surisuta.jp/admin/support?ticket=${encodeURIComponent(input.ticketNo)}|管理画面で受付を開く>`,
  ].join('\n')
  return { title, text, meta: ticketMeta(input.category) }
}
