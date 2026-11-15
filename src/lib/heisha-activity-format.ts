// 弊社、限界につき。の利用通知と日次レポートの文面を組み立てる。DB にも Slack にも触らない（テストできるようにするため）。
import { excerptMasked } from './slack/notify'

/** 受け付ける操作。これ以外は 400 で断る。 */
export const HEISHA_EVENTS = ['session_saved'] as const

/**
 * 受け付ける種別（記録の種類）。これ以外は 400 で断る。アプリが種別を送るようになったら、ここへ足す。
 * 送られなかったときは「unspecified」として数える。
 */
export const HEISHA_RECORD_KINDS = ['work', 'overtime', 'holiday', 'night', 'other'] as const
export type HeishaRecordKind = typeof HEISHA_RECORD_KINDS[number] | 'unspecified'

export const HEISHA_KIND_LABEL: Record<HeishaRecordKind, string> = {
  work: '通常の勤務', overtime: '残業', holiday: '休日の勤務', night: '深夜の勤務', other: 'その他', unspecified: '未指定',
}

/** 1回に受け取る文字列の上限。 */
export const HEISHA_LIMITS = {
  bodyBytes: 1024,
  eventIdMax: 80,
  lengthMax: 100000,
  excerptInputMax: 160,
  excerptShown: 80,
} as const

export type HeishaActivityInput = {
  event: typeof HEISHA_EVENTS[number]
  eventId: string
  kind: HeishaRecordKind
  length: number | null
  excerpt: string | null
}

/** 受け取った JSON を検証する。通らなければ null。余計な項目は捨てる（転送も保存もしない）。 */
export function parseHeishaActivity(body: unknown): HeishaActivityInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Record<string, unknown>
  if (typeof b.event !== 'string' || !(HEISHA_EVENTS as readonly string[]).includes(b.event)) return null
  if (typeof b.eventId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(b.eventId)) return null
  let kind: HeishaRecordKind = 'unspecified'
  if (b.kind !== undefined) {
    if (typeof b.kind !== 'string' || !(HEISHA_RECORD_KINDS as readonly string[]).includes(b.kind)) return null
    kind = b.kind as HeishaRecordKind
  }
  let length: number | null = null
  if (b.length !== undefined) {
    if (typeof b.length !== 'number' || !Number.isInteger(b.length) || b.length < 0 || b.length > HEISHA_LIMITS.lengthMax) return null
    length = b.length
  }
  let excerpt: string | null = null
  if (b.excerpt !== undefined) {
    if (typeof b.excerpt !== 'string' || Array.from(b.excerpt).length > HEISHA_LIMITS.excerptInputMax) return null
    excerpt = b.excerpt
  }
  return { event: b.event as HeishaActivityInput['event'], eventId: b.eventId, kind, length, excerpt }
}

/** 日本時間の日時の表記。 */
export function jstNow(now = new Date()): string {
  return `${now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（日本時間）`
}

/** 1件保存されたときの通知本文。抜粋は includeExcerpt が true で、受け取った場合だけ載せる。 */
export function buildSavedText(input: HeishaActivityInput, todayCount: number | null, opts: { includeExcerpt: boolean; now?: Date }): string {
  const lines = [
    '【弊社、限界につき。】利用されました',
    '操作：記録の保存',
    '結果：端末に1件保存されました。',
    todayCount === null ? '本日の保存件数：未集計（本番以外の環境）' : `本日の保存件数：${todayCount.toLocaleString('ja-JP')}件目（全端末の合計。日本時間の0時で数え直します）`,
    `種別：${HEISHA_KIND_LABEL[input.kind]}`,
  ]
  if (input.length !== null) lines.push(`文字数：${input.length.toLocaleString('ja-JP')}文字`)
  lines.push(`記録ID（通知用の識別子）：${input.eventId.slice(0, 8)}`)
  lines.push(`通知日時：${jstNow(opts.now)}`)
  if (opts.includeExcerpt && input.excerpt !== null) {
    lines.push(`本文の抜粋（伏せ字つき・最大${HEISHA_LIMITS.excerptShown}文字）：${excerptMasked(input.excerpt, HEISHA_LIMITS.excerptShown)}`)
    lines.push('抜粋以外のメモ・会社名・給与・記録の内容は送信していません。')
  } else {
    lines.push('メモ・会社名・給与・記録の内容は送信していません。')
  }
  return lines.join('\n')
}

export type HeishaDayStats = {
  day: string                         // YYYY-MM-DD（日本時間）
  total: number
  byKind: Partial<Record<HeishaRecordKind, number>>
  lengthCount: number                 // 文字数を受け取った件数
  lengthSum: number
}

function pct(n: number, total: number): string {
  return total > 0 ? `${Math.round((n / total) * 100)}%` : '0%'
}

/** 日次レポートの本文。前日の件数、前々日との差、種別の割合、文字数の平均。 */
export function buildDailyReportText(today: HeishaDayStats, prev: HeishaDayStats | null, now = new Date()): string {
  const lines = ['【弊社、限界につき。】日次の利用状況', `対象日：${today.day}（日本時間）`, `記録の保存：${today.total.toLocaleString('ja-JP')}件`]
  if (prev) {
    const diff = today.total - prev.total
    lines.push(`前日（${prev.day}）：${prev.total.toLocaleString('ja-JP')}件（${diff > 0 ? '+' : ''}${diff.toLocaleString('ja-JP')}件）`)
  } else {
    lines.push('前日との比較：集計がないため出せません')
  }
  const kinds = (Object.keys(today.byKind) as HeishaRecordKind[]).filter((k) => (today.byKind[k] ?? 0) > 0).sort((a, b) => (today.byKind[b] ?? 0) - (today.byKind[a] ?? 0))
  if (today.total === 0) lines.push('種別の割合：保存がなかったため出しません')
  else {
    lines.push('種別の割合：')
    for (const k of kinds) lines.push(`・${HEISHA_KIND_LABEL[k]}：${today.byKind[k]}件（${pct(today.byKind[k] ?? 0, today.total)}）`)
  }
  lines.push(today.lengthCount > 0
    ? `文字数の平均：${Math.round(today.lengthSum / today.lengthCount).toLocaleString('ja-JP')}文字（文字数を受け取った${today.lengthCount.toLocaleString('ja-JP')}件の平均）`
    : '文字数の平均：文字数を受け取った記録がありません')
  lines.push(`集計日時：${jstNow(now)}`)
  lines.push('メモ・会社名・給与・記録の内容は集計していません。')
  return lines.join('\n')
}
