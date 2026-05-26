import { sendEmail } from '@/lib/email'

// ============================================
// ドヤHR メール送信
// ============================================

interface InvitationEmailParams {
  to: string
  organizationName: string
  inviterName?: string | null
  role: string
  inviteUrl: string
  expiresAt: Date
}

/**
 * 招待メールを送信する
 * RESEND_API_KEY が未設定の場合はconsole.logにフォールバック
 */
export async function sendInvitationEmail(params: InvitationEmailParams): Promise<void> {
  const roleName = getRoleDisplayName(params.role)
  const expiresLabel = formatDate(params.expiresAt)
  const inviterLabel = params.inviterName || '管理者'

  const subject = `【ドヤHR】${params.organizationName} への招待`
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f4f4f7; padding: 40px 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #7f19e6; padding: 24px 32px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 20px;">ドヤHR</h1>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #333;">こんにちは、</p>
      <p style="font-size: 15px; color: #555; line-height: 1.7;">
        <strong>${inviterLabel}</strong> さんから
        <strong>${params.organizationName}</strong> の${roleName}として招待されました。
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${params.inviteUrl}"
           style="display: inline-block; background: #7f19e6; color: #ffffff; text-decoration: none;
                  padding: 14px 40px; border-radius: 6px; font-size: 15px; font-weight: bold;">
          招待を受ける
        </a>
      </div>
      <p style="font-size: 13px; color: #999; line-height: 1.6;">
        この招待は <strong>${expiresLabel}</strong> まで有効です。<br/>
        心当たりのない場合はこのメールを無視してください。
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="font-size: 12px; color: #bbb;">
        招待URLが開けない場合はこちらをコピーしてブラウザに貼り付けてください:<br/>
        <span style="word-break: break-all;">${params.inviteUrl}</span>
      </p>
    </div>
  </div>
</body>
</html>
`.trim()

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[HrEmail] RESEND_API_KEY not set — invitation email logged instead of sent')
    console.log(`  To: ${params.to}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  InviteURL: ${params.inviteUrl}`)
    return
  }

  const result = await sendEmail({
    to: params.to,
    subject,
    html,
    tags: [
      { name: 'service', value: 'doya-hr' },
      { name: 'type', value: 'invitation' },
    ],
  })

  if (!result.success) {
    console.error('[HrEmail] Failed to send invitation email:', result.error)
  }
}

function getRoleDisplayName(role: string): string {
  switch (role) {
    case 'OWNER': return 'オーナー'
    case 'ADMIN': return '管理者'
    case 'MANAGER': return 'マネージャー'
    case 'MEMBER': return 'メンバー'
    default: return 'メンバー'
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
