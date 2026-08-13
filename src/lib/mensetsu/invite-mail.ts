// ============================================
// 面接のご案内メール
// ============================================
// 発行時（/api/mensetsu/sessions）と、あとからの送信（.../[id]/invite）の
// 両方から使う。文面が2か所に分かれると片方だけ直して食い違うため、ここに寄せる。
import { sendEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/html-escape'

export interface InviteMailInput {
  to: string
  candidateName: string | null
  organizationName: string
  jobTitle: string
  durationMin: number
  expiresAt: Date
  url: string
}

/** 面接URLを組み立てる。⚠️ VERCEL_URL は使わない（デプロイ保護で弾かれる） */
export function interviewUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
  return `${base}/mensetsu/live/${token}`
}

export async function sendInviteMail(input: InviteMailInput): Promise<boolean> {
  const { to, candidateName, organizationName, jobTitle, durationMin, expiresAt, url } = input
  const res = await sendEmail({
    to,
    subject: `【${organizationName}】一次面接（${jobTitle}）のご案内`,
    html: `
      <div style="font-family:sans-serif;line-height:1.8;color:#0a0f3c">
        ${candidateName ? `<p>${escapeHtml(candidateName)}様</p>` : ''}
        <p>${escapeHtml(organizationName)} の ${escapeHtml(jobTitle)} にご応募いただき、ありがとうございます。</p>
        <p>一次面接のご案内です。下のリンクをお開きください。</p>
        <p><a href="${escapeHtml(url)}" style="color:#0066ff">${escapeHtml(url)}</a></p>
        <ul style="color:#425071;font-size:14px">
          <li>所要時間は約${durationMin}分です。</li>
          <li>この面接はAIが面接官として実施します。</li>
          <li>静かな場所で、マイクをお使いいただける環境からご受験ください。</li>
          <li>${escapeHtml(expiresAt.toLocaleDateString('ja-JP'))} まで有効です。</li>
        </ul>
        <p style="color:#8a94ad;font-size:13px">
          このリンクはご本人専用です。他の方に転送しないでください。<br>
          お心当たりがない場合は破棄してください。
        </p>
      </div>`,
  })
  return res.success
}
