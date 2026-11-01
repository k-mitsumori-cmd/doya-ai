'use client'
// 開発用の確認ページの中身。/api/support-chat/* への送信を、画面の中のモックで受ける（本番では page.tsx が 404 にする）
// ⚠️ ネットワークには出さない。Slack にも送らない
import { useEffect } from 'react'
import { answerQuestion, mockAnswerer } from '@/lib/support-chat/answer'
import { makeTicketNo, replyEtaText } from '@/lib/support-chat/ticket'
import { parseAskBody, parseTicketBody } from '@/lib/support-chat/request'

const SAMPLE = { ticketNo: 'DY-261026-K7PM', category: 'billing', status: 'waiting_user', createdAt: new Date(Date.now() - 86_400_000).toISOString() }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export default function SupportChatPreviewBody() {
  useEffect(() => {
    const original = window.fetch
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('/api/support-chat/tickets/')) {
        await new Promise((r) => setTimeout(r, 300))
        const now = Date.now()
        return json({ ticket: { ...SAMPLE, messages: [
          { role: 'user', body: '請求書払いに切り替えられますか。', createdAt: new Date(now - 86_400_000).toISOString() },
          { role: 'staff', body: 'お問い合わせありがとうございます。請求書払いは、年払いの契約でご利用いただけます。手続きの書類をお送りしますので、会社名をお知らせください。', createdAt: new Date(now - 3_600_000).toISOString() },
          ...(init?.method === 'POST' ? [{ role: 'user', body: String(JSON.parse(String(init.body)).message), createdAt: new Date().toISOString() }] : []),
        ] } })
      }
      if (url.includes('/api/support-chat/tickets')) {
        return json({ tickets: [{ ...SAMPLE, summary: '請求書払いに切り替えられますか。', unread: true }], unread: 1 })
      }
      if (url.includes('/api/support-chat/ask')) {
        await new Promise((r) => setTimeout(r, 600))
        const parsed = parseAskBody(JSON.parse(String(init?.body ?? '{}')))
        if ('error' in parsed) return json({ error: parsed.error }, 400)
        const res = await answerQuestion(mockAnswerer, { question: parsed.question, history: parsed.history, toolId: null })
        return json({ kind: res.kind, text: res.text, sources: res.sources, category: res.kind === 'staff' ? res.category : null })
      }
      if (url.includes('/api/support-chat/ticket')) {
        await new Promise((r) => setTimeout(r, 600))
        const parsed = parseTicketBody(JSON.parse(String(init?.body ?? '{}')))
        if ('error' in parsed) return json({ error: parsed.error }, 400)
        return json({ ok: true, ticketNo: makeTicketNo(), replyEta: replyEtaText(parsed.category), history: true })
      }
      return original(input, init)
    }
    return () => { window.fetch = original }
  }, [])
  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 120px', display: 'grid', gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>サポートチャット（開発用の確認ページ）</h1>
      <p style={{ margin: 0, color: '#4b5b74', lineHeight: 1.8 }}>
        右下のボタンから開きます。答えはモックで、外には何も送りません。試す例:「料金はいくらですか」「ドヤ記事作成で何ができますか」「二重に請求されています」「明日の天気」。
      </p>
    </div>
  )
}
