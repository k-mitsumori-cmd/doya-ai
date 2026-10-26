// ============================================
// 運営の返信を知らせるメールの文面（純粋な関数）
// ============================================
// 丁寧な敬語で、絵文字を使わない。返信の本文は HTML として効かないようにエスケープする。
// リンクの base URL は NEXTAUTH_URL か本番の URL（VERCEL_URL は使わない。CLAUDE.md の決まり）。
import { escapeHtml } from '@/lib/html-escape'

export function supportBaseUrl(raw: string | undefined = process.env.NEXTAUTH_URL): string {
  const v = (raw || '').trim().replace(/\/+$/, '')
  return /^https?:\/\//.test(v) ? v : 'https://doya-ai.surisuta.jp'
}

/** 画面でその受付を開くリンク（チャットが ?support= を見て開く） */
export function ticketUrl(ticketNo: string, base = supportBaseUrl()): string {
  return `${base}/home?support=${encodeURIComponent(ticketNo)}`
}

export function buildReplyEmail(input: { ticketNo: string; userName: string | null; reply: string; base?: string }): { subject: string; html: string } {
  const name = input.userName ? `${escapeHtml(input.userName)} 様` : 'お客さま'
  const body = escapeHtml(input.reply.trim()).replace(/\n/g, '<br>')
  const url = ticketUrl(input.ticketNo, input.base ?? supportBaseUrl())
  const subject = `【ドヤAI】お問い合わせへのご返信（受付番号 ${input.ticketNo}）`
  const html = [
    '<div style="font-family: sans-serif; line-height: 1.8; color: #0b1b33; max-width: 560px;">',
    `<p>${name}</p>`,
    '<p>ドヤAIをご利用いただき、ありがとうございます。<br>お問い合わせいただいた件について、運営の担当者からご返信いたします。</p>',
    `<p style="margin: 0 0 4px; font-size: 13px; color: #4b5b74;">受付番号 ${escapeHtml(input.ticketNo)}</p>`,
    `<div style="padding: 12px 16px; border-left: 4px solid #0066ff; background: #f6f8fc;">${body}</div>`,
    `<p>続けてご質問がある場合は、下のリンクからチャットでお返事ください。<br><a href="${escapeHtml(url)}">ドヤAIでお問い合わせの続きを開く</a></p>`,
    '<p style="font-size: 12px; color: #8a97ab;">このメールは送信専用のアドレスから送っています。このメールへの返信には、お答えできない場合があります。</p>',
    '<p>ドヤAI 運営</p>',
    '</div>',
  ].join('\n')
  return { subject, html }
}
