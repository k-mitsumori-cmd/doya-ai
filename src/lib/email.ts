// ============================================
// メール送信基盤（Resend）
// ============================================
// 全サービス共通で使えるメール送信ユーティリティ
// 環境変数: RESEND_API_KEY, RESEND_FROM_EMAIL

// サービス名の切り替え（ドヤAI → ドヤ部下）。旗 NEXT_PUBLIC_BRAND_RENAME_ROLLOUT=all のときだけ、送り主の名前・件名・本文の「ドヤAI」を置き換える。
// ⚠️ このファイルは検証用のスクリプト（scripts/security-regression/verify-email-error-privacy.cjs）が require 無しの vm で動かす。
//    そのため src/lib/brand を import せず、ここに同じ決まりを小さく持つ（名前の文字がずれていないことは src/lib/brand/brand.test.ts が確かめる）。
//    ツール名（ドヤAIO・ドヤAI質問リンク・ドヤAI商談）は置き換えない。
function renameBrandText(text: string): string {
  if (!text || (process.env.NEXT_PUBLIC_BRAND_RENAME_ROLLOUT ?? '').trim().toLowerCase() !== 'all') return text
  return text.replace(/ドヤAI(?!O|質問リンク|商談)/g, 'ドヤ部下') // brand-keep: 置き換え前の名前を探す正規表現
}

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

  // 切り替え後（旗 NEXT_PUBLIC_BRAND_RENAME_ROLLOUT=all）は、送り主の名前・件名・本文の「ドヤAI」を「ドヤ部下」に。旗が off の間は一切変えない
  const fromEmail = renameBrandText(params.from || process.env.RESEND_FROM_EMAIL || 'noreply@doya-ai.surisuta.jp')
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
        subject: renameBrandText(params.subject),
        html: renameBrandText(params.html),
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
