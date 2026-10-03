// ============================================
// メール送信基盤（Resend）
// ============================================
// 全サービス共通で使えるメール送信ユーティリティ
// 環境変数: RESEND_API_KEY, RESEND_FROM_EMAIL

const RESEND_API_URL = 'https://api.resend.com/emails'
const SEND_EMAIL_TIMEOUT_MS = 12_000

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
  tags?: { name: string; value: string }[]
}

export interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

/**
 * Resend APIでメール送信
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY is not set, skipping email send')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  const fromEmail = params.from || process.env.RESEND_FROM_EMAIL || 'noreply@doya-ai.surisuta.jp'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEND_EMAIL_TIMEOUT_MS)

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        reply_to: params.replyTo,
        tags: params.tags,
      }),
    })

    if (!res.ok) {
      console.error('[Email] Resend API error:', res.status)
      return { success: false, error: `Resend API error: ${res.status}` }
    }

    const data = await res.json()
    return { success: true, id: data.id }
  } catch {
    console.error('[Email] Failed to send:')
    return { success: false, error: 'メールの送信に失敗しました。' }
  } finally {
    clearTimeout(timeout)
  }
}
