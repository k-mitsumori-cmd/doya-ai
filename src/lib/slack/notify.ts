/**
 * Slack 通知の共通の送り口（正本: docs/slack-notifications.md）。
 *
 * どの通知も、次の順で並べる。
 *   1. 見出し … 【重さ】アプリ名｜種類：件名
 *   2. 発生時刻・本文・項目 … 各送信元が組み立てる
 *   3. リンク
 *
 * - 重さは 緊急 / 要対応 / お知らせ の3段階。@channel で人を呼ぶのは「緊急」と、明示した通知だけ。
 * - 絵文字は使わない。見出しからは必ず、本文からは利用者の文章を含む通知（お問い合わせ）以外で取り除く。
 * - 同じ内容の連続は間引く（インスタンス内メモリ。サーバーレスのインスタンスをまたぐ重複は防げない）。
 *
 * このファイルは外部に依存しない（prisma なども import しない）。fetch と AbortSignal だけを使うので、
 * Next.js・Cloudflare Workers・Node 18 以降のどれでも動く。ほかのリポジトリへはこのファイルをそのまま
 * コピーして使う（決まりの文書: docs/slack-standard.md）。コピー先では下の版を書き換えない。
 */

export const SLACK_NOTIFY_VERSION = '1.2.1'

export type SlackKind = 'error' | 'billing' | 'usage' | 'inquiry' | 'report'
export type SlackSeverity = 'urgent' | 'action' | 'info'

export const SLACK_KIND_LABEL: Record<SlackKind, string> = {
  error: 'エラー',
  billing: '売上・課金',
  usage: '利用状況',
  inquiry: 'お問い合わせ',
  report: '定期レポート',
}

export const SLACK_SEVERITY_LABEL: Record<SlackSeverity, string> = {
  urgent: '緊急',
  action: '要対応',
  info: 'お知らせ',
}

export type SlackMeta = {
  /** アプリ名（例: ドヤAI / 呪い日記 / 弊社、限界につき。） */
  app: string
  kind: SlackKind
  severity: SlackSeverity
  /** @channel で全員を呼ぶか。省略時は severity が urgent のときだけ呼ぶ */
  mention?: boolean
}

/** 見出しの先頭から取り除く、重さ・種類を表す札。 */
const TAG_WORDS = new Set([
  '要対応', '要確認', '重大', '緊急', 'エラー', 'お知らせ', '警告', '異常', '障害',
  '要対応・エラー', '要対応・重大', '修正依頼',
])

/** 見出しの札として使われてきたアプリ名。 */
const KNOWN_APPS = [
  'ドヤAI', 'ドヤバディ', 'ドヤ部下', 'ドヤマーケ', 'ドヤマーケAI', '呪い日記', 'ゆるせん', '許せん', '推しにマイル', 'ヒトリジメ', // brand-keep: 旧名も新名も、見出しの札として読む
  '弊社、限界につき。', '旅行ツール', 'LINE', 'X', 'LINE配信管理', 'X投稿管理', 'AI商談', 'ドヤプロマネ', 'AI秘書',
]

const KNOWN_APPS_LONGEST_FIRST = [...KNOWN_APPS].sort((x, y) => y.length - x.length)

const UNIFIED_HEADING = /^【(緊急|要対応|お知らせ)】[^｜\n]+｜[^：\n]+(?:：(.*))?$/

export function slackHeading(meta: SlackMeta, title: string): string {
  const t = title.trim()
  return `【${SLACK_SEVERITY_LABEL[meta.severity]}】${meta.app}｜${SLACK_KIND_LABEL[meta.kind]}${t ? `：${t}` : ''}`
}

// ---------------------------------------------------------------
// 絵文字の除去
// ---------------------------------------------------------------
// :tada: のような Slack の絵文字コード。前後が空白・行頭行末・括弧のときだけ対象にする
// （URL や時刻 10:30:00 を誤って消さないため）。後ろの空白1つも一緒に消す。
const SHORTCODE = /(^|[\s(（「]):[a-z0-9_+-]*[a-z][a-z0-9_+-]*:(?=$|[\s)）」、。,.!！?？*])[ \t]?/gim
// 絵文字の文字そのもの。© ® ™ と評価の ★☆ は記号として残す。
const PICTOGRAPH = /(?![©®™★☆])\p{Extended_Pictographic}[\uFE0F\u20E3\u200D]*(?:\p{Emoji_Modifier})?[ \t]?|[\uFE0F\u20E3]/gu
// <URL|ラベル> と `コード` の中は触らない
const PROTECTED_SPAN = /(<[^>\n]*>|```[\s\S]*?```|`[^`\n]*`)/

export function stripEmoji(input: string): string {
  return input
    .split(PROTECTED_SPAN)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(SHORTCODE, '$1').replace(PICTOGRAPH, '')))
    .join('')
    .replace(/[ \t\u3000]+$/gm, '')
}

// ---------------------------------------------------------------
// 見出しの統一
// ---------------------------------------------------------------
/** 旧来の見出し行から件名だけを取り出す。 */
export function extractTitle(line: string, app?: string): string {
  let s = stripEmoji(line).replace(/\*/g, '').trim()
  const unified = s.match(UNIFIED_HEADING)
  if (unified) return (unified[2] || '').trim()
  // 先頭の【…】や[…]が札（アプリ名・重さ）なら外す。それ以外は括弧を外して件名に残す。
  // 【テスト】は本番の通知と見分けるために件名の先頭に残す。
  let testMark = ''
  for (;;) {
    const m = s.match(/^[【[]([^】\]]{1,30})[】\]]\s*/)
    if (!m) break
    const inner = m[1]!.trim()
    s = s.slice(m[0].length)
    if (inner === 'テスト' || /通知テスト/.test(inner)) { testMark = `【${inner}】`; continue }
    const tokens = inner.split(/[・･/／]/).map((x) => x.trim()).filter(Boolean)
    const isTag = TAG_WORDS.has(inner)
      || tokens.every((tok) => TAG_WORDS.has(tok) || KNOWN_APPS.includes(tok) || tok === app)
    if (!isTag) {
      s = `${inner} ${s}`.trim()
      break
    }
  }
  // 「【要対応・エラー】弊社、限界につき。／…」のように札の後ろにアプリ名が来る形
  for (const name of [app, ...KNOWN_APPS_LONGEST_FIRST]) {
    if (name && (s === name || /^[／/・:：\s]/.test(s.slice(name.length, name.length + 1)) && s.startsWith(name))) {
      s = s.slice(name.length)
      break
    }
  }
  s = s.replace(/^[：:・／/\s]+/, '').trim()
  return `${testMark}${s}`
}

type Block = Record<string, unknown>

/**
 * 文字列をすべて fn で変える。url の値は既定では変えない（絵文字の除去でリンクを壊さないため）。
 * urlFn を渡すと、url の値にはそちらをかける（伏せるときはクエリと # を外す）。
 */
function mapStrings(value: unknown, fn: (s: string) => string, urlFn?: (s: string) => string): unknown {
  if (typeof value === 'string') return fn(value)
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn, urlFn))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [
      k,
      k === 'url' ? (urlFn && typeof v === 'string' ? urlFn(v) : v) : mapStrings(v, fn, urlFn),
    ]))
  }
  return value
}

/** URL のクエリと # から後ろを外す（伏せるとき用）。 */
function stripUrlQuery(url: string): string {
  return url.replace(/[?#].*$/, '')
}

function blockText(b: Block): string {
  const t = b.text as { text?: string } | string | undefined
  return typeof t === 'string' ? t : t?.text || ''
}

const MENTION_LINE = /^<!(channel|here)>$/

/**
 * Slack の送信データ（{ text, blocks }）を共通の形にそろえる。
 * - text の見出し行（1行目）を「【重さ】アプリ名｜種類：件名」に置き換える
 * - blocks があれば、先頭の header ブロックを同じ見出しにする（無ければ足す）
 * - 絵文字を取り除く（お問い合わせは利用者の文章を守るため見出しだけ）
 * - 緊急なら @channel を付ける
 * 何度かけても同じ結果になる。
 */
export function styleSlackPayload<T>(payload: T, meta: SlackMeta): T {
  if (!payload || typeof payload !== 'object') return payload
  const p = { ...(payload as Record<string, unknown>) }
  const mention = meta.mention ?? meta.severity === 'urgent'
  const keepBody = meta.kind === 'inquiry'
  // エラーと課金の通知は、例外の文面や外部サービスの応答が混ざりやすいので必ず伏せる
  const redact = meta.kind === 'error' || meta.kind === 'billing'
  const clean = (s: string) => {
    const t = keepBody ? s : stripEmoji(s)
    return redact ? redactSecrets(t) : t
  }

  const rawText = typeof p.text === 'string' ? p.text : ''
  const lines = rawText.split('\n')
  let hasMention = false
  while (lines.length && (MENTION_LINE.test(lines[0]!.trim()) || lines[0]!.trim() === '')) {
    if (MENTION_LINE.test(lines[0]!.trim())) hasMention = true
    lines.shift()
  }

  const blocks = Array.isArray(p.blocks) ? (p.blocks as Block[]) : null
  const headerIndex = blocks ? blocks.findIndex((b) => b.type === 'header') : -1
  // header ブロックがあれば、件名はそちらを正とする（text は通知の一行表示用の要約のため）
  const sourceTitleLine = headerIndex >= 0 ? blockText(blocks![headerIndex]!) : (lines[0] ?? '')
  const title = redact ? redactSecrets(extractTitle(sourceTitleLine, meta.app)) : extractTitle(sourceTitleLine, meta.app)
  const heading = slackHeading(meta, title)

  const bodyLines = lines.slice(1).map(clean)
  const textOut = [
    ...(mention || hasMention ? ['<!channel>'] : []),
    `*${heading}*`,
    ...bodyLines,
  ].join('\n')
  p.text = textOut

  if (blocks) {
    const header = { type: 'header', text: { type: 'plain_text', text: heading.slice(0, 150), emoji: false } }
    let rest = blocks.map((b) => (keepBody && !redact ? b : (mapStrings(b, clean, redact ? stripUrlQuery : undefined) as Block)))
    if (headerIndex >= 0) rest = rest.filter((_, i) => i !== headerIndex)
    // 本文の最初の section が旧見出しだけなら重複するので外す
    const first = rest[0]
    if (first && first.type === 'section' && !first.fields) {
      const ft = blockText(first).split('\n')
      if (ft.length && extractTitle(ft[0]!, meta.app) === title && title) {
        const remain = ft.slice(1).join('\n').trim()
        if (remain) {
          const text = first.text as Record<string, unknown>
          rest[0] = { ...first, text: { ...text, text: remain } }
        } else {
          rest = rest.slice(1)
        }
      }
    }
    const mentionBlock = mention || hasMention
      ? [{ type: 'section', text: { type: 'mrkdwn', text: '<!channel>' } }]
      : []
    p.blocks = [...mentionBlock, header, ...rest].slice(0, 50)
  }
  // 古い形の attachments にも、伏せる処理と絵文字の除去をかける
  if (Array.isArray(p.attachments) && (redact || !keepBody)) {
    p.attachments = mapStrings(p.attachments, clean, redact ? stripUrlQuery : undefined)
  }
  return p as T
}

// ---------------------------------------------------------------
// 旧来の通知の種類・重さを見出しから推定する（メタ情報を渡していない送信元の受け皿）
// ---------------------------------------------------------------
export function inferSlackMeta(payload: unknown, fallbackApp = 'ドヤAI'): SlackMeta {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const text = typeof p.text === 'string' ? p.text : ''
  const blocks = Array.isArray(p.blocks) ? (p.blocks as Block[]) : []
  const header = blocks.find((b) => b.type === 'header')
  const firstLine = text.split('\n').find((l) => l.trim() && !MENTION_LINE.test(l.trim()))
    || (header ? blockText(header) : '')
  const line = stripEmoji(firstLine).replace(/\*/g, '')

  const unified = line.match(/^【(緊急|要対応|お知らせ)】([^｜\n]+)｜([^：\n]+)/)
  if (unified) {
    const sev = (Object.keys(SLACK_SEVERITY_LABEL) as SlackSeverity[]).find((k) => SLACK_SEVERITY_LABEL[k] === unified[1])!
    const kind = (Object.keys(SLACK_KIND_LABEL) as SlackKind[]).find((k) => SLACK_KIND_LABEL[k] === unified[3]) || 'usage'
    return { app: unified[2]!, kind, severity: sev }
  }

  const appMatch = line.match(/^[【[]([^】\]]{1,30})[】\]]/)
  const appTokens = appMatch ? appMatch[1]!.split(/[・･]/) : []
  const app = appTokens.find((t) => KNOWN_APPS.includes(t))
    || KNOWN_APPS_LONGEST_FIRST.find((a) => a.length > 1 && line.includes(a))
    || fallbackApp

  const severity: SlackSeverity = /重大|緊急|CRITICAL|ダウン(?!ロード)|停止/.test(line)
    ? 'urgent'
    : /要対応|要確認|エラー|失敗|障害|異常|警告|ERROR|WARN|切れ/.test(line) ? 'action' : 'info'
  const kind: SlackKind = /問い合わせ|ご意見|フィードバック|要望|バグ報告|申込|メール/.test(line) && !/レポート/.test(line)
    ? 'inquiry'
    : /レポート|日報|朝刊|週報|月報|週次|月次|日次|まとめ|総括|報告/.test(line)
      ? 'report'
      : /エラー|失敗|障害|異常|ダウン(?!ロード)|停止|応答|到達/.test(line)
        ? 'error'
        : /決済|課金|入金|解約|売上|契約|プラン|体験|購入|返金/.test(line) ? 'billing' : 'usage'
  return { app, kind, severity }
}

// ---------------------------------------------------------------
// 個人情報と利用者の文字列（1.1.0 で追加）
// ---------------------------------------------------------------
/** メールアドレスを「先頭2文字＋***＋@ドメイン」にする。形が違えば「（非表示）」。 */
export function maskEmail(email: string | null | undefined): string {
  const m = (email ?? '').trim().match(/^([^@\s]+)@([^@\s]+)$/)
  if (!m) return '（非表示）'
  return `${m[1]!.slice(0, 2)}***@${m[2]}`
}

/** 電話番号を末尾4桁だけ残して伏せる。 */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 4) return '（非表示）'
  return `***-${digits.slice(-4)}`
}

/**
 * 利用者が書いた文字列を Slack に載せられる形にする。
 * < > & を実体参照にして <!channel> やリンクの差し込みを防ぎ、mrkdwn の記号の前に
 * ゼロ幅スペースを入れて書式として解釈されないようにする。
 */
export function escapeSlackText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([*_~`])/g, '\u200b$1')
}

/**
 * 気持ちや悩みが書かれた自由記述を、冒頭だけにして載せる（既定80文字）。
 * 改行は空白にまとめ、切ったときは「…（全N文字）」を付ける。エスケープ済みで返す。
 */
export function excerpt(text: string | null | undefined, max = 80): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return '（未記入）'
  const chars = Array.from(t)
  const cut = chars.length > max ? `${chars.slice(0, max).join('')}…（全${chars.length}文字）` : t
  return escapeSlackText(cut)
}

/**
 * エラーの文面に紛れ込んだ秘密や個人情報を伏せる（1.2.0 で追加。kind が error と billing の通知には styleSlackPayload が必ずかける。
 * 1.2.1 からは blocks の url の値と attachments にもかける）。
 * 伏せるもの: Slack の Webhook の URL・トークン、Bearer、JWT、Stripe などのキー、token= や password= の値、
 * メールアドレス、URL の ? から後ろ（クエリと #）。照合用の ID（UUID）は秘密ではないので残す。
 */
export function redactSecrets(input: string): string {
  return input
    .replace(/https:\/\/hooks\.slack\.com\/[^\s<>|`"']+/gi, '[Webhook 非表示]')
    .replace(/\bxox[abprs]-[A-Za-z0-9-]+/g, '[Slack トークン非表示]')
    .replace(/\bBearer\s+[^\s`"'<>]+/gi, 'Bearer [非表示]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[認証情報非表示]')
    .replace(/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g, '[キー非表示]')
    .replace(/\b((?:access_?token|refresh_?token|token|secret|password|passwd|api[_-]?key|apikey|client_secret)\s*[=:]\s*)("?)[^\s,;&`"'<>]+\2/gi, '$1[非表示]')
    .replace(/(https?:\/\/[^\s<>|`"'?#]+)[?#][^\s<>|`"']*/gi, '$1?[非表示]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => maskEmail(m))
}

/** 「N人目」の表記。数えられなかったときは null を渡す。 */
export function ordinalLabel(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? `${n.toLocaleString('ja-JP')}人目` : '人数は未取得'
}

// ---------------------------------------------------------------
// 間引き
// ---------------------------------------------------------------
const recent = new Map<string, number>()

/** 同じキーが windowMs 以内に送られていれば false。送ってよければ記録して true。 */
export function reserveSlackSlot(key: string, windowMs: number, now = Date.now()): boolean {
  const prev = recent.get(key)
  if (prev !== undefined && now - prev < windowMs) return false
  recent.set(key, now)
  if (recent.size > 1000) {
    for (const [k, t] of recent) if (now - t > 24 * 3_600_000) recent.delete(k)
  }
  return true
}

/** 送信に失敗したときに予約を取り消す（次の再送を間引かないため）。 */
export function releaseSlackSlot(key: string): void {
  recent.delete(key)
}

/** テスト用。 */
export function resetSlackDedupe(): void {
  recent.clear()
}

function hashText(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

/** 発生時刻などの数字を除いた本文で、同じ内容かどうかを判定するためのキー。 */
export function contentKey(payload: unknown): string {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const text = `${typeof p.text === 'string' ? p.text : ''}${Array.isArray(p.blocks) ? JSON.stringify(p.blocks) : ''}`
  return hashText(text.replace(/\d{1,4}[/:年月日-]\d{1,2}(?:[/:月日-]\d{1,2})*(?:[ T日]?\d{1,2}:\d{2}(?::\d{2})?)?/g, '#'))
}

// ---------------------------------------------------------------
// 送信
// ---------------------------------------------------------------
export type PostSlackOptions = {
  meta?: SlackMeta
  /** 間引きのキー。省略時は本文から作る（時刻の違いは無視） */
  dedupeKey?: string
  /** 間引く時間。0 で間引かない。既定 5 分 */
  dedupeWindowMs?: number
  timeoutMs?: number
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

export type PostSlackResult = 'sent' | 'deduped'

/**
 * Incoming Webhook に送る。Slack が 200 以外を返したら throw する（呼び出し元で握る）。
 * Webhook の URL はログに出さない。
 */
export async function postSlack(webhookUrl: string, payload: Record<string, unknown>, opts: PostSlackOptions = {}): Promise<PostSlackResult> {
  if (!webhookUrl) throw new Error('Slack webhook URL is not configured')
  const body = opts.meta ? styleSlackPayload(payload, opts.meta) : payload
  const windowMs = opts.dedupeWindowMs ?? 5 * 60_000
  const key = windowMs > 0 ? `slack:${hashText(webhookUrl)}:${opts.dedupeKey ?? contentKey(body)}` : ''
  if (key && !reserveSlackSlot(key, windowMs)) return 'deduped'
  try {
    const res = await (opts.fetchImpl ?? fetch)(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 8_000),
    })
    if (!res.ok) {
      void res.body?.cancel().catch(() => {})
      throw new Error(`Slack webhook returned ${res.status}`)
    }
    return 'sent'
  } catch (e) {
    if (key) releaseSlackSlot(key)
    throw e
  }
}
