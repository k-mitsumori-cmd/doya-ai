import { prisma } from './prisma'

interface NewUserNotificationData {
  userId: string
  email: string | null
  name: string | null
  image: string | null
  provider: string
}

/**
 * 新規ユーザー登録通知を送信
 */
export async function sendNewUserNotification(data: NewUserNotificationData): Promise<void> {
  try {
    // 通知設定を取得
    const emailSetting = await prisma.systemSetting.findUnique({
      where: { key: 'email_notifications' },
    })
    const slackWebhook = await prisma.systemSetting.findUnique({
      where: { key: 'slack_webhook' },
    })

    const emailEnabled = emailSetting?.value === 'true'
    const webhookUrl = slackWebhook?.value || ''

    // 通知を送信（非同期で実行、エラーはログに記録するだけ）
    const promises: Promise<void>[] = []

    // メール通知（将来実装）
    if (emailEnabled) {
      // TODO: メール送信機能を実装
      console.log('[Notification] Email notification enabled (not implemented yet)')
    }

    // Slack通知
    if (webhookUrl) {
      promises.push(sendSlackNotification(webhookUrl, data))
    }

    // すべての通知を並列実行（エラーは個別にキャッチ）
    await Promise.allSettled(promises)
  } catch (e) {
    // 通知エラーはログに記録するだけ（ユーザー登録を妨げない）
    console.error('Failed to send new user notification:', e)
  }
}

/**
 * Slack Webhookに通知を送信
 */
async function sendSlackNotification(webhookUrl: string, data: NewUserNotificationData): Promise<void> {
  try {
    const message = {
      text: '🎉 新規ユーザーが登録されました',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎉 新規ユーザー登録',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*名前:*\n${data.name || '（未設定）'}`,
            },
            {
              type: 'mrkdwn',
              text: `*メールアドレス:*\n${data.email || '（未設定）'}`,
            },
            {
              type: 'mrkdwn',
              text: `*認証プロバイダー:*\n${data.provider}`,
            },
            {
              type: 'mrkdwn',
              text: `*ユーザーID:*\n\`${data.userId}\``,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*登録日時:* ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `<https://doya-ai.surisuta.jp/admin/users|管理画面で確認する>`,
            },
          ],
        },
      ],
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      throw new Error(`Slack webhook returned ${response.status}`)
    }
  } catch (e) {
    console.error('Failed to send Slack notification:', e)
    throw e
  }
}

