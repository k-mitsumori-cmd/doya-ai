import { prisma } from '@/lib/prisma'
import { decryptToken } from './crypto'
import { buildMime, toBase64Url } from './mime'
import { refreshAccessToken } from './oauth'

const parsedLimit = Number(process.env.GMAIL_DAILY_LIMIT)
export const GMAIL_DAILY_LIMIT = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 30

export class GmailSendError extends Error {
  constructor(
    message: string,
    public code: 'NOT_CONNECTED' | 'REAUTH_REQUIRED' | 'LIMIT_REACHED' | 'INVALID_INPUT' | 'SEND_FAILED',
    public status = 400
  ) {
    super(message)
  }
}

const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/

export interface SendGmailInput {
  userId: string
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
  source?: string
}

function startOfTodayJst(): Date {
  const jstNow = new Date(Date.now() + 9 * 3600 * 1000)
  jstNow.setUTCHours(0, 0, 0, 0)
  return new Date(jstNow.getTime() - 9 * 3600 * 1000)
}

export async function getTodaySendCount(userId: string): Promise<number> {
  return prisma.gmailSendLog.count({ where: { userId, status: 'SUCCESS', sentAt: { gte: startOfTodayJst() } } })
}

// 送信中（PENDING）も数える。10 分以上前の PENDING は異常終了とみなして数えない
async function countReserved(userId: string): Promise<number> {
  return prisma.gmailSendLog.count({
    where: {
      userId,
      sentAt: { gte: startOfTodayJst() },
      OR: [{ status: 'SUCCESS' }, { status: 'PENDING', sentAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } }],
    },
  })
}

// 利用者がボタンを押した API ルートからだけ呼ぶこと（AI や cron からは呼ばない）
export async function sendGmail(input: SendGmailInput): Promise<{ messageId: string; from: string }> {
  const to = input.to.trim()
  const subject = input.subject.trim()
  if (!EMAIL_RE.test(to)) throw new GmailSendError('宛先のメールアドレスの形式が正しくありません', 'INVALID_INPUT')
  if (input.replyTo && !EMAIL_RE.test(input.replyTo.trim()))
    throw new GmailSendError('返信先のメールアドレスの形式が正しくありません', 'INVALID_INPUT')
  if (!subject) throw new GmailSendError('件名を入力してください', 'INVALID_INPUT')
  if (!input.text.trim()) throw new GmailSendError('本文を入力してください', 'INVALID_INPUT')
  if (subject.length > 200 || input.text.length > 50000)
    throw new GmailSendError('件名または本文が長すぎます', 'INVALID_INPUT')

  const conn = await prisma.gmailConnection.findUnique({ where: { userId: input.userId } })
  if (!conn) throw new GmailSendError('Gmail と連携されていません。設定から連携してください', 'NOT_CONNECTED')
  if (conn.status !== 'ACTIVE')
    throw new GmailSendError('Gmail の連携が取り消されています。連携し直してください', 'REAUTH_REQUIRED', 401)

  // 上限の枠を先に確保する（PENDING の行を作ってから数える）。同時に押されても上限を超えない
  const log = await prisma.gmailSendLog.create({
    data: { userId: input.userId, toEmail: to, subject, source: input.source, status: 'PENDING' },
  })
  if ((await countReserved(input.userId)) > GMAIL_DAILY_LIMIT) {
    await prisma.gmailSendLog
      .update({ where: { id: log.id }, data: { status: 'FAILED', error: '上限超過' } })
      .catch(() => {})
    throw new GmailSendError(`本日の送信上限（${GMAIL_DAILY_LIMIT}通）に達しました。明日以降にお試しください`, 'LIMIT_REACHED', 429)
  }

  const fail = async (message: string, code: GmailSendError['code'], status: number) => {
    await prisma.gmailSendLog
      .update({ where: { id: log.id }, data: { status: 'FAILED', error: message.slice(0, 300) } })
      .catch(() => {})
    return new GmailSendError(message, code, status)
  }

  // access token を refresh token から取得（期限切れの自動更新）
  const { ok, data } = await refreshAccessToken(decryptToken(conn.refreshTokenEnc))
  if (!ok || !data.access_token) {
    if (data.error === 'invalid_grant') {
      await prisma.gmailConnection.update({ where: { userId: input.userId }, data: { status: 'REVOKED', revokedAt: new Date() } })
      throw await fail('Gmail の連携が取り消されています。連携し直してください', 'REAUTH_REQUIRED', 401)
    }
    throw await fail('Google への接続に失敗しました。時間をおいてお試しください', 'SEND_FAILED', 502)
  }

  const raw = toBase64Url(
    buildMime({ from: conn.email, to, subject, text: input.text, html: input.html, replyTo: input.replyTo?.trim() })
  )
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
    cache: 'no-store',
  })
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } }
  if (!res.ok || !body.id) {
    if (res.status === 401 || res.status === 403) {
      throw await fail('Gmail への送信が許可されていません。連携し直してください', 'REAUTH_REQUIRED', 401)
    }
    throw await fail(`送信に失敗しました（${body.error?.message || res.status}）`, 'SEND_FAILED', 502)
  }
  await prisma.gmailSendLog.update({
    where: { id: log.id },
    data: { status: 'SUCCESS', messageId: body.id, sentAt: new Date() },
  })
  return { messageId: body.id, from: conn.email }
}
