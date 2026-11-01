// 定期チェック（health-alert / service-operations）が失敗したときの通知文を組み立てる。
// 「エラーがあります」だけで終わらせず、どの項目が・どのURLで・どんな状態コードやエラーで・
// いつから・何回続けて落ちているかを、そのまま読める日本語で返す。
// DB や fetch には触れない純粋関数だけを置く（テストは health-check-report.test.ts）。

/** 失敗の続き具合。最初に失敗を確認した時刻と、連続した失敗の回数。 */
export type FailureStreak = { count: number; since: string }

/** fetch などで投げられたエラーを、原因の見当がつく日本語の一文にする。 */
export function describeFetchError(error: unknown, timeoutMs?: number): string {
  if (!(error instanceof Error)) return `原因不明のエラー（${String(error).slice(0, 200)}）`
  const cause = (error as { cause?: { code?: string; message?: string } }).cause
  const code = cause?.code || (error as { code?: string }).code || ''
  const raw = `${error.name}: ${error.message}${cause?.message ? `（${cause.message}）` : ''}`.slice(0, 300)
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return `応答がありませんでした（${timeoutMs ? `${Math.round(timeoutMs / 1000)}秒で打ち切り` : 'タイムアウト'}）。${raw}`
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return `ドメイン名を引けませんでした（DNS: ${code}）。${raw}`
  if (code === 'ECONNREFUSED') return `接続を拒否されました（${code}）。サーバーが止まっている可能性があります。${raw}`
  if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') return `接続が途中で切れました（${code}）。${raw}`
  if (/CERT|SSL|TLS/i.test(code) || /certificate/i.test(error.message)) return `SSL 証明書の確認に失敗しました（${code || 'TLS'}）。${raw}`
  return raw
}

/** 応答本文の先頭を、通知に載せられる長さの1行にする（HTML のタグは落とす）。 */
export function bodySnippet(body: string, max = 200): string {
  const text = body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}

/** 前回までの連続失敗に今回の結果を足す。成功したら null（続きを切る）。 */
export function nextStreak(previous: FailureStreak | null, failed: boolean, now: string): FailureStreak | null {
  if (!failed) return null
  return previous && previous.count > 0 ? { count: previous.count + 1, since: previous.since } : { count: 1, since: now }
}

function jst(iso: string): string {
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(iso))
}

/** 外形監視（health-alert）の1件の失敗を、通知の本文にする。 */
export function formatHealthFailure(opts: {
  url: string
  at: string
  status?: number
  rttMs?: number
  body?: string
  error?: string
  streak?: FailureStreak | null
  intervalMinutes?: number
}): string {
  const lines = [
    `確認したURL：${opts.url}`,
    `確認した時刻：${jst(opts.at)}（日本時間）`,
    opts.status !== undefined ? `状態コード：HTTP ${opts.status}` : '状態コード：なし（応答が届いていません）',
  ]
  if (opts.rttMs !== undefined) lines.push(`往復時間：${opts.rttMs}ms`)
  if (opts.error) lines.push(`エラー：${opts.error}`)
  if (opts.body) lines.push(`応答の先頭：${opts.body}`)
  if (opts.streak) {
    const minutes = Math.max(0, Math.round((Date.parse(opts.at) - Date.parse(opts.streak.since)) / 60000))
    lines.push(`連続した失敗：${opts.streak.count}回（最初の失敗 ${jst(opts.streak.since)}、約${minutes}分前から${opts.intervalMinutes ? `。${opts.intervalMinutes}分ごとに確認` : ''}）`)
  }
  return lines.join('\n')
}

/** 運用ジョブ（service-operations）の失敗を、通知の本文にする。 */
export function formatJobFailure(opts: { mode: string; at: string; error: unknown; streak?: FailureStreak | null }): string {
  const err = opts.error instanceof Error ? opts.error : null
  const message = (err ? `${err.name}: ${err.message}` : String(opts.error)).slice(0, 500)
  const frame = err?.stack?.split('\n').find(l => /\/(src|seo)\//.test(l))?.trim().replace(/^.*?((?:src|seo)\/[^\s)]+).*$/, '$1')
  const lines = [
    `ジョブ：service-operations（mode=${opts.mode}）`,
    `失敗した時刻：${jst(opts.at)}（日本時間）`,
    `エラー：${message}`,
  ]
  if (frame) lines.push(`発生箇所（推定）：${frame}`)
  if (opts.streak) lines.push(`連続した失敗：${opts.streak.count}回（最初の失敗 ${jst(opts.streak.since)}）`)
  return lines.join('\n')
}
