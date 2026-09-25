import { applyContextComment } from '../../../../lib/slack-context-comment';
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/promane/feedback
 * フィードバックをSlackに通知
 * Body: { type: 'bug'|'feature'|'other', message: string, page?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    const userEmail = session?.user?.email || '匿名'
    const userName = session?.user?.name || '匿名'

    const body = await req.json().catch(() => ({}))
    const { type = 'other', message, page = '' } = body || {}

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'message は必須です' }, { status: 400 })
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: 'メッセージは5000文字以内' }, { status: 400 })
    }

    // 通知が落ちても管理画面から確認できるよう、ログイン済みの声は先に保存する。
    const saved = userId ? await prisma.serviceFeedback.create({
      data: {
        userId,
        serviceId: 'promane',
        text: `【${type === 'bug' ? 'バグ報告' : type === 'feature' ? '機能要望' : 'その他'}】${typeof page === 'string' && page ? `（${page.slice(0, 300)}）` : ''}\n${message.trim()}`.slice(0, 5400),
      },
      select: { id: true },
    }).catch((error) => {
      console.error('[promane/feedback] DB保存失敗', { code: typeof error?.code === 'string' ? error.code : undefined })
      return null
    }) : null

    // Slack Webhook URL を取得（SystemSetting または環境変数）
    let webhookUrl: string | null = null
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'slack_webhook' },
      })
      webhookUrl = (setting?.value as string) || null
    } catch {}
    if (!webhookUrl) {
      webhookUrl = process.env.SLACK_WEBHOOK_URL || null
    }

    const typeLabel = type === 'bug' ? '🐛 バグ報告' : type === 'feature' ? '💡 機能要望' : '💬 その他'
    const slackPayload = {
      text: `ドヤプロマネ フィードバック`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${typeLabel} - ドヤプロマネ`, emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*ユーザー:*\n${userName}` },
            { type: 'mrkdwn', text: `*メール:*\n${userEmail}` },
            { type: 'mrkdwn', text: `*種別:*\n${typeLabel}` },
            { type: 'mrkdwn', text: `*ページ:*\n${page || 'N/A'}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*メッセージ:*\n\`\`\`${message.slice(0, 2900)}\`\`\`` },
        },
      ],
    }

    if (!webhookUrl) {
      console.error('[promane/feedback] Slack Webhook URL未設定', { feedbackId: saved?.id })
      if (saved) return NextResponse.json({ success: true, stored: true, notified: false })
      return NextResponse.json({ error: '現在フィードバックを送信できません。内容を残したまま、時間をおいて再試行してください。' }, { status: 503 })
    }

    try {
      const r = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applyContextComment(slackPayload)),
        signal: AbortSignal.timeout(10_000),
      })
      if (!r.ok) {
        console.error('[promane/feedback] Slack webhook failed', { status: r.status, feedbackId: saved?.id })
        if (saved) return NextResponse.json({ success: true, stored: true, notified: false })
        return NextResponse.json({ error: 'フィードバックを送信できませんでした。内容を残したまま、再試行してください。' }, { status: 503 })
      }
    } catch (e) {
      console.error('[promane/feedback] Slack送信失敗', { feedbackId: saved?.id, error: e instanceof Error ? e.name : 'UnknownError' })
      if (saved) return NextResponse.json({ success: true, stored: true, notified: false })
      return NextResponse.json({ error: 'フィードバックを送信できませんでした。内容を残したまま、再試行してください。' }, { status: 503 })
    }

    return NextResponse.json({ success: true, stored: !!saved, notified: true })
  } catch (e: any) {
    console.error('[promane/feedback]', e)
    return NextResponse.json({ error: 'フィードバック送信に失敗しました' }, { status: 500 })
  }
}
