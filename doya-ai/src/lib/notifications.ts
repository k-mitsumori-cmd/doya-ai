import { prisma } from './prisma'

export type ErrorNotificationData = {
  errorMessage: string
  errorStack?: string
  pathname?: string
  userId?: string
  userEmail?: string | null
  userName?: string | null
  errorDigest?: string
  userAgent?: string
  timestamp: string
  httpStatus?: number
  requestMethod?: string
  requestUrl?: string
  requestBody?: string
}

/**
 * APIエラー通知（Slack等）を送信する
 * - 設定は `SystemSetting` の `slack_webhook` を参照
 * - 設定が無い場合はno-op
 */
export async function sendErrorNotification(data: ErrorNotificationData): Promise<void> {
  try {
    const slackWebhook = await prisma.systemSetting.findUnique({
      where: { key: 'slack_webhook' },
    })

    const webhookUrl = slackWebhook?.value || ''
    if (!webhookUrl) {
      // 設定が無ければ静かにスキップ
      return
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: formatErrorMessage(data),
      }),
    })
  } catch (e) {
    // 通知の失敗で処理自体を止めない
    console.error('[Notification] Failed to sendErrorNotification:', e)
  }
}

function formatErrorMessage(data: ErrorNotificationData): string {
  const lines: string[] = []
  lines.push(`*[API Error]* ${data.timestamp}`)
  if (data.pathname) lines.push(`- path: ${data.pathname}`)
  if (data.httpStatus) lines.push(`- status: ${data.httpStatus}`)
  if (data.requestMethod) lines.push(`- method: ${data.requestMethod}`)
  if (data.requestUrl) lines.push(`- url: ${data.requestUrl}`)
  if (data.userId || data.userEmail) lines.push(`- user: ${data.userId || ''} ${data.userEmail || ''}`.trim())
  lines.push('')
  lines.push(`*message*`)
  lines.push(truncate(data.errorMessage, 1800))
  if (data.requestBody) {
    lines.push('')
    lines.push(`*requestBody*`)
    lines.push(truncate(data.requestBody, 1200))
  }
  if (data.errorStack) {
    lines.push('')
    lines.push(`*stack*`)
    lines.push(truncate(data.errorStack, 1800))
  }
  return lines.join('\n')
}

function truncate(s: string, max: number): string {
  const str = String(s || '')
  return str.length > max ? `${str.slice(0, max)}…` : str
}

