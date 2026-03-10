// ============================================
// ドヤインタビューAI-X — メールテンプレート
// ============================================

import { sendEmail } from '@/lib/email'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://doya-ai.surisuta.jp'

/**
 * アンケート依頼メール
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
  const surveyUrl = `${BASE_URL}/interviewx/respond/${params.shareToken}`
  const brandColor = params.brandColor || '#6366f1'

  return sendEmail({
    to: params.to,
    subject: `【インタビューのお願い】${params.companyName || 'ドヤAI'}より - ${params.projectTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,${brandColor},${brandColor}dd);padding:32px;text-align:center;">
        ${params.companyLogo ? `<img src="${params.companyLogo}" alt="" style="max-height:48px;margin-bottom:16px;">` : ''}
        <h1 style="color:white;font-size:20px;margin:0;font-weight:700;">インタビューのお願い</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 16px;">
          ${params.respondentName ? `${params.respondentName} 様` : 'ご担当者 様'}
        </p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 16px;">
          ${params.companyName || '弊社'}より、インタビュー記事作成のためのアンケートをお送りいたします。
        </p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 24px;">
          <strong>テーマ：${params.projectTitle}</strong>
        </p>
        <p style="color:#64748b;font-size:14px;line-height:1.8;margin:0 0 24px;">
          下のボタンからアンケートにご回答ください。所要時間は約10-15分です。<br>
          ご回答いただいた内容をもとに、AIが記事のドラフトを自動作成いたします。
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${surveyUrl}" style="display:inline-block;background:${brandColor};color:white;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:700;">
            アンケートに回答する
          </a>
        </div>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
          このメールに心当たりがない場合は、お手数ですが無視してください。
        </p>
      </div>
    </div>
    <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px;">
      Powered by ドヤインタビューAI-X
    </p>
  </div>
</body>
</html>`,
    tags: [{ name: 'service', value: 'interviewx' }, { name: 'type', value: 'survey-invite' }],
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
        <h1 style="color:white;font-size:20px;margin:0;font-weight:700;">アンケート回答が完了しました</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 16px;">
          ${params.companyUserName ? `${params.companyUserName} 様` : 'ご担当者 様'}
        </p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 24px;">
          <strong>「${params.projectTitle}」</strong>のアンケートに${params.respondentName || '回答者'}さんが回答しました。
        </p>
        <div style="background:#f1f5f9;border-radius:12px;padding:20px;margin:0 0 24px;">
          <p style="color:#475569;font-size:14px;margin:0;">
            回答内容を確認し、AIで記事を生成できます。
          </p>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="${projectUrl}" style="display:inline-block;background:#6366f1;color:white;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:700;">
            回答を確認 & 記事を生成
          </a>
        </div>
      </div>
    </div>
    <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px;">
      Powered by ドヤインタビューAI-X
    </p>
  </div>
</body>
</html>`,
    tags: [{ name: 'service', value: 'interviewx' }, { name: 'type', value: 'response-complete' }],
  })
}

/**
 * 記事完成通知（企業+回答者へ）
 */
export async function sendArticleReadyEmail(params: {
  to: string
  recipientName?: string
  projectTitle: string
  articleTitle?: string
  // 企業向けならprojectUrl、回答者向けならfeedbackUrl
  actionUrl: string
  actionLabel: string
}) {
  return sendEmail({
    to: params.to,
    subject: `【記事ドラフト完成】${params.projectTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">📝</div>
        <h1 style="color:white;font-size:20px;margin:0;font-weight:700;">記事ドラフトが完成しました</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 16px;">
          ${params.recipientName ? `${params.recipientName} 様` : 'ご担当者 様'}
        </p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 24px;">
          <strong>「${params.projectTitle}」</strong>の記事ドラフトが完成しました。
          ${params.articleTitle ? `<br>記事タイトル：「${params.articleTitle}」` : ''}
        </p>
        <p style="color:#64748b;font-size:14px;line-height:1.8;margin:0 0 24px;">
          内容をご確認いただき、修正点やフィードバックがあればお知らせください。
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${params.actionUrl}" style="display:inline-block;background:#6366f1;color:white;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:700;">
            ${params.actionLabel}
          </a>
        </div>
      </div>
    </div>
    <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px;">
      Powered by ドヤインタビューAI-X
    </p>
  </div>
</body>
</html>`,
    tags: [{ name: 'service', value: 'interviewx' }, { name: 'type', value: 'article-ready' }],
  })
}

/**
 * フィードバック通知
 */
export async function sendFeedbackNotificationEmail(params: {
  to: string
  recipientName?: string
  projectTitle: string
  feedbackAuthor: string
  feedbackPreview: string
  actionUrl: string
}) {
  return sendEmail({
    to: params.to,
    subject: `【新しいフィードバック】${params.projectTitle} - ${params.feedbackAuthor}さんからのコメント`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;text-align:center;">
        <h1 style="color:white;font-size:18px;margin:0;font-weight:700;">💬 新しいフィードバック</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 16px;">
          ${params.recipientName ? `${params.recipientName} 様` : 'ご担当者 様'}
        </p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 16px;">
          <strong>${params.feedbackAuthor}</strong>さんが「${params.projectTitle}」にフィードバックを追加しました。
        </p>
        <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin:0 0 24px;border-left:4px solid #6366f1;">
          <p style="color:#475569;font-size:14px;margin:0;line-height:1.6;">
            "${params.feedbackPreview.slice(0, 200)}${params.feedbackPreview.length > 200 ? '...' : ''}"
          </p>
        </div>
        <div style="text-align:center;">
          <a href="${params.actionUrl}" style="display:inline-block;background:#6366f1;color:white;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:15px;font-weight:700;">
            フィードバックを確認
          </a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`,
    tags: [{ name: 'service', value: 'interviewx' }, { name: 'type', value: 'feedback' }],
  })
}
