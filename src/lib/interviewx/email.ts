// ============================================
// ドヤヒヤリングAI — メールテンプレート
// ============================================

import { sendEmail } from '@/lib/email'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://doya-ai.surisuta.jp'

/**
 * ヒヤリング依頼メール
 */
export async function sendSurveyInviteEmail(params: {
  to: string
  respondentName?: string
  companyName?: string
  companyLogo?: string
  brandColor?: string
  projectTitle: string
  shareToken: string
}) {
  const chatUrl = `${BASE_URL}/interviewx/respond/${params.shareToken}`
  const brandColor = params.brandColor || '#6366f1'

  return sendEmail({
    to: params.to,
    subject: `【ヒヤリングのお願い】${params.companyName || 'ドヤAI'}より - ${params.projectTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,${brandColor},${brandColor}dd);padding:32px;text-align:center;">
        ${params.companyLogo ? `<img src="${params.companyLogo}" alt="" style="max-height:48px;margin-bottom:16px;">` : ''}
        <h1 style="color:white;font-size:20px;margin:0;font-weight:700;">ヒヤリングのお願い</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 16px;">
          ${params.respondentName ? `${params.respondentName} 様` : 'ご担当者 様'}
        </p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 16px;">
          ${params.companyName || '弊社'}より、ヒヤリングへのご協力をお願いいたします。
        </p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 24px;">
          <strong>テーマ：${params.projectTitle}</strong>
        </p>
        <p style="color:#64748b;font-size:14px;line-height:1.8;margin:0 0 24px;">
          下のボタンからAIチャットでヒヤリングにご回答ください。所要時間は約10-15分です。<br>
          AIが対話形式でお話をお伺いし、回答内容を自動で要約いたします。
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${chatUrl}" style="display:inline-block;background:${brandColor};color:white;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:700;">
            ヒヤリングに回答する
          </a>
        </div>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
          このメールに心当たりがない場合は、お手数ですが無視してください。
        </p>
      </div>
    </div>
    <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px;">
      Powered by ドヤヒヤリングAI
    </p>
  </div>
</body>
</html>`,
    tags: [{ name: 'service', value: 'interviewx' }, { name: 'type', value: 'hearing-invite' }],
  })
}

/**
 * 回答完了通知（企業側へ）
 */
export async function sendResponseCompleteEmail(params: {
  to: string
  companyUserName?: string
  projectTitle: string
  respondentName?: string
  projectId: string
}) {
  const projectUrl = `${BASE_URL}/interviewx/projects/${params.projectId}`

  return sendEmail({
    to: params.to,
    subject: `【回答完了】${params.projectTitle} - ${params.respondentName || '回答者'}さんが回答しました`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">✅</div>
        <h1 style="color:white;font-size:20px;margin:0;font-weight:700;">ヒヤリング回答が完了しました</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 16px;">
          ${params.companyUserName ? `${params.companyUserName} 様` : 'ご担当者 様'}
        </p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 24px;">
          <strong>「${params.projectTitle}」</strong>のヒヤリングに${params.respondentName || '回答者'}さんが回答しました。
        </p>
        <div style="background:#f1f5f9;border-radius:12px;padding:20px;margin:0 0 24px;">
          <p style="color:#475569;font-size:14px;margin:0;">
            回答内容を確認し、AIで要約を生成できます。
          </p>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="${projectUrl}" style="display:inline-block;background:#6366f1;color:white;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:700;">
            回答を確認 & 要約を生成
          </a>
        </div>
      </div>
    </div>
    <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px;">
      Powered by ドヤヒヤリングAI
    </p>
  </div>
</body>
</html>`,
    tags: [{ name: 'service', value: 'interviewx' }, { name: 'type', value: 'response-complete' }],
  })
}
