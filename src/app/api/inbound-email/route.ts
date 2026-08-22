export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { postToSlackBlocks } from '@/lib/notifications'
import { notifyAlert } from '@/lib/alert'
import { escapeHtml } from '@/lib/html-escape'

/**
 * 受信メールの通知エンドポイント
 *
 * なぜ必要か（2026-08）:
 *   問い合わせの導線は「アプリ内フォーム」と「メール（info@surisuta.jp）」の2本ある。
 *   フォーム側は Slack 通知が飛ぶが、**メール側は受信箱に届くだけ**で、
 *   気づかなければ何日でも放置される。実際 support@surisuta.jp は受信箱が
 *   存在せず、そこ宛のメールは全部バウンスしていたのに誰も気づかなかった。
 *   「届いたことが必ず見える」状態にするため、メールも Slack に流す。
 *
 * 設計方針:
 *   受信箱をこちら側から読みに行かない（Gmail の認可・委任が要る上に、
 *   認可が切れると**また無音で止まる**）。Gmail 側から叩いてもらう。
 *   叩く側は Google Apps Script（scripts/gmail-to-slack.gs）を想定。
 *   Cloudflare Email Worker や Zapier 等からでも同じ形式で送れる。
 *
 * 認証: x-inbound-secret ヘッダ（環境変数 INBOUND_EMAIL_SECRET と一致）
 *
 * POST body:
 *   {
 *     messageId: string   // 重複通知を防ぐための一意ID（Gmailのメッセージid等）
 *     from: string        // 差出人
 *     to?: string         // 宛先（info@ / support@ のどちらに来たか）
 *     subject: string
 *     body: string        // 本文（先頭のみでよい）
 *     receivedAt?: string // ISO文字列
 *     link?: string       // Gmailで開くURL
 *   }
 */

/** 同一メッセージの二重通知を防ぐ（同一インスタンス内・15分） */
const seen = new Map<string, number>()
const SEEN_TTL_MS = 15 * 60_000

function alreadyNotified(id: string): boolean {
  const now = Date.now()
  for (const [k, at] of seen) if (now - at > SEEN_TTL_MS) seen.delete(k)
  if (seen.has(id)) return true
  seen.set(id, now)
  return false
}

export async function POST(request: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET
  if (!secret) {
    // ⚠️ 未設定で通してしまうと誰でもSlackに投稿できる。必ず落とす。
    console.error('[InboundEmail] INBOUND_EMAIL_SECRET が未設定')
    return NextResponse.json({ error: 'not configured' }, { status: 500 })
  }
  if (request.headers.get('x-inbound-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid json' }, { status: 400 })

  const messageId = String(body.messageId || '').slice(0, 200)
  const from = String(body.from || '不明').slice(0, 200)
  const to = String(body.to || '').slice(0, 200)
  const subject = String(body.subject || '(件名なし)').slice(0, 300)
  const text = String(body.body || '').slice(0, 1500)
  const link = String(body.link || '').slice(0, 500)
  const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date()

  if (!messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
  if (alreadyNotified(messageId)) return NextResponse.json({ ok: true, skipped: 'duplicate' })

  const jst = receivedAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  const lines = [
    `*お問い合わせメールが届きました*`,
    `差出人: ${escapeHtml(from)}`,
    to ? `宛先: ${escapeHtml(to)}` : null,
    `受信: ${jst}`,
    `件名: ${escapeHtml(subject)}`,
    '',
    // ⚠️ 送信者が書いた文字列。Slackのmrkdwn記号を効かせない
    escapeHtml(text),
    link ? `\n<${link}|Gmailで開く>` : null,
  ].filter((l): l is string => l !== null)

  try {
    await postToSlackBlocks('お問い合わせメールが届きました', [
      { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
    ])
  } catch (e: any) {
    // 通知経路が落ちていること自体を見えるようにする（黙って捨てない）
    await notifyAlert({
      level: 'critical',
      title: '受信メールの Slack 通知に失敗しました',
      context: 'お問い合わせメールが届いていますが、通知できていません',
      detail: `from=${from} / subject=${subject}\n${e?.message || e}`,
      dedupKey: 'inbound-email-notify-failed',
    }).catch(() => {})
    return NextResponse.json({ error: 'notify failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** 疎通確認用（設定が済んでいるかを見るだけ。内容は返さない） */
export async function GET() {
  return NextResponse.json({ ok: true, configured: Boolean(process.env.INBOUND_EMAIL_SECRET) })
}
