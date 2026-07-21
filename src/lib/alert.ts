/**
 * 運用アラート（エラー急増・応答遅延・ダウン・依存障害）を Slack に通知する共通基盤。
 *
 * 送信先の優先順位:
 *   1. SLACK_ALERT_WEBHOOK_URL（アラート専用チャンネルを分けたい場合・DB非依存で最も確実）
 *   2. SystemSetting `slack_webhook`（イベント/サマリ通知と同じ運用チャンネル・既定）
 *   3. SLACK_ANALYTICS_WEBHOOK_URL（DB障害時のフォールバック＝DB非依存）
 *
 * レート制限/バースト検知はサーバーレスの各インスタンス内メモリで行う（インスタンス
 * 跨ぎでは重複しうるが Slack 連投抑止には十分）。これらの関数は絶対に throw しない。
 */
import { prisma, withRetry } from './prisma'

function slackEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function getAlertWebhook(): Promise<string | undefined> {
  if (process.env.SLACK_ALERT_WEBHOOK_URL) return process.env.SLACK_ALERT_WEBHOOK_URL
  try {
    const s = await withRetry(() =>
      prisma.systemSetting.findUnique({ where: { key: 'slack_webhook' } }),
    )
    if (s?.value) return s.value
  } catch {
    // DB障害時は下のフォールバックへ
  }
  return process.env.SLACK_ANALYTICS_WEBHOOK_URL || undefined
}

// --- レート制限（インスタンス内メモリ） ---
const lastSent = new Map<string, number>()
export function shouldSend(key: string, cooldownMs: number): boolean {
  const now = Date.now()
  const prev = lastSent.get(key)
  if (prev !== undefined && now - prev < cooldownMs) return false
  lastSent.set(key, now)
  if (lastSent.size > 500) {
    for (const [k, t] of lastSent) if (now - t > 3_600_000) lastSent.delete(k)
  }
  return true
}

// --- バースト検知 ---
const errorTimes: number[] = []
const BURST_WINDOW_MS = 5 * 60_000
const BURST_THRESHOLD = Math.max(2, Number(process.env.ALERT_BURST_THRESHOLD) || 15)
export function recordErrorAndCheckBurst(): { count: number; burst: boolean } {
  const now = Date.now()
  errorTimes.push(now)
  while (errorTimes.length > 0 && now - (errorTimes[0] as number) > BURST_WINDOW_MS) {
    errorTimes.shift()
  }
  return { count: errorTimes.length, burst: errorTimes.length >= BURST_THRESHOLD }
}
export function burstThreshold(): number {
  return BURST_THRESHOLD
}

function nowJst(): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date())
}

/**
 * スタックトレースからアプリ内の最初のフレーム（原因ファイル:行）を推定する。
 * node_modules / Next 内部 / node: 内部フレームは除外し、src/ 以降に短縮する。
 */
export function firstAppFrame(stack?: string): string {
  if (!stack) return ''
  for (const l of stack.split('\n')) {
    if (/node_modules|node:internal|webpack-internal|\/\.next\//.test(l)) continue
    const m = l.match(/([^\s()]+\.(?:tsx?|jsx?)):(\d+):(\d+)/)
    if (m && m[1]) {
      const file = m[1].replace(/^.*?((?:src|seo|app)\/)/, '$1')
      return `${file}:${m[2]}`
    }
  }
  return ''
}

/**
 * そのまま AI（Claude Code 等）に貼って修正を依頼できる、自己完結した依頼文を組み立てる。
 * 原因の種別・推定ファイル・発生箇所・環境・スタックを明示する。
 */
export function buildAiRepairPrompt(opts: {
  system: string
  where: string
  errorType?: string
  message: string
  originFile?: string
  stack?: string
  env: string
  extra?: Extra
}): string {
  const extraLines = opts.extra
    ? Object.entries(opts.extra)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `- ${k}: ${String(v).slice(0, 200)}`)
    : []
  return [
    `【修正依頼】${opts.system} で発生した下記エラーの原因を特定し、修正パッチを提示してください。`,
    `- 発生箇所: ${opts.where || '(不明)'}`,
    opts.errorType ? `- エラー種別: ${opts.errorType}` : '',
    `- メッセージ: ${opts.message}`,
    opts.originFile ? `- 原因ファイル(推定): ${opts.originFile}` : '',
    `- 環境: ${opts.env}`,
    ...extraLines,
    opts.stack ? `- スタック:\n${opts.stack}` : '',
    `根本原因を説明し、該当ファイルの修正差分と再発防止策を提示してください。`,
  ]
    .filter(Boolean)
    .join('\n')
}

export type AlertLevel = 'warn' | 'critical'
type Extra = Record<string, string | number | boolean | null | undefined>

/**
 * 運用アラートを Slack に送る。dedupKey を渡すと cooldownMs の間は同一キーの再送を抑止。
 */
export async function notifyAlert(opts: {
  title: string
  detail?: string
  context?: string
  level?: AlertLevel
  extra?: Extra
  dedupKey?: string
  cooldownMs?: number
  /** そのまま AI に貼れる修正依頼文（あれば専用ブロックで表示） */
  aiRepair?: string
}): Promise<void> {
  const { title, detail, context, level = 'warn', extra, dedupKey, cooldownMs = 10 * 60_000, aiRepair } = opts
  if (dedupKey && !shouldSend(`alert:${dedupKey}`, cooldownMs)) return

  const webhook = await getAlertWebhook()
  if (!webhook) return

  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
  const label = level === 'critical' ? '重大' : '警告'
  const extraFields = extra
    ? Object.entries(extra)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => ({
          type: 'mrkdwn' as const,
          text: `*${slackEscape(k)}*\n${slackEscape(String(v)).slice(0, 400)}`,
        }))
    : []

  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `ドヤAI アラート[${label}] ${title}`.slice(0, 150), emoji: false },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*環境*\n${slackEscape(env)}` },
        ...(context ? [{ type: 'mrkdwn' as const, text: `*対象*\n${slackEscape(context)}` }] : []),
        ...extraFields,
      ].slice(0, 10),
    },
  ]
  if (detail) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: slackEscape(detail).slice(0, 2800) },
    })
  }
  if (aiRepair) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*AIへの修正依頼（コピペ用）*\n\`\`\`${slackEscape(aiRepair).slice(0, 2800)}\`\`\``,
      },
    })
  }
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `発生: ${nowJst()} (JST)` }],
  })

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `ドヤAI アラート[${label}] ${title}: ${detail ?? ''}`.slice(0, 200),
        blocks,
      }),
    })
    if (!res.ok) {
      console.error('notifyAlert: slack webhook failed', res.status, await res.text().catch(() => ''))
    }
  } catch (e) {
    console.error('notifyAlert: failed to post', e)
  }
}
