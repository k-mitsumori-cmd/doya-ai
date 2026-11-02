import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parseErrorReport } from '@/lib/error-report-input'
import { submitErrorReport } from '@/lib/error-report-operation'
import { readOperationalJson, OperationalBodyError } from '@/lib/operational-json'
import { clientIp, quotaSubject, consumeDailyQuota } from '@/lib/server-daily-quota'
import { sendErrorReportNotification } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30
const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })

export async function POST(req: NextRequest) {
  let sameOrigin = false
  try {
    const origin = req.headers.get('origin') || ''
    const parsed = new URL(origin)
    // Next's internal request URL can use localhost behind a proxy. Compare the
    // actual HTTP Host, never an Origin-derived or arbitrary forwarded-host value.
    sameOrigin = parsed.origin === origin && parsed.host.toLowerCase() === (req.headers.get('host') || req.nextUrl.host).toLowerCase()
      && (parsed.protocol === 'https:' || process.env.VERCEL_ENV !== 'production' && parsed.protocol === 'http:')
  } catch { /* Missing/null/malformed Origin is rejected. */ }
  if (!sameOrigin || (req.headers.get('sec-fetch-site') && req.headers.get('sec-fetch-site') !== 'same-origin')) return json({ success: false }, 403)
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ success: false }, 415)
  let input
  try { input = parseErrorReport(await readOperationalJson(req, 16384)) }
  catch (error) { return json({ success: false, message: '入力内容を確認してください。' }, error instanceof OperationalBodyError ? error.status : 400) }
  // Preview/local acceptance uses mocks. It must never send messages or touch a production counter.
  if (process.env.VERCEL_ENV !== 'production') return json({ success: false, message: 'この環境では報告を送信できません。' }, 503)
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    const subject = quotaSubject(userId ? `error-report:user:${userId}` : `error-report:ip:${clientIp(req.headers)}`)
    const result = await submitErrorReport(input, subject,
      () => consumeDailyQuota('user-error-report', quotaSubject(clientIp(req.headers)), 10),
      () => sendErrorReportNotification(input, userId))
    if (result === 'sent') return json({ success: true, reportId: input.reportId }, 200)
    if (result === 'pending') return json({ success: false, state: 'pending', message: '送信処理中です。少し待ってから送信結果を確認してください。' }, 202)
    if (result === 'conflict') return json({ success: false, message: '報告内容が変更されています。ページを開き直してください。' }, 409)
    if (result === 'limited') return json({ success: false, message: '本日の報告回数の上限に達しました。お問い合わせをご利用ください。' }, 429)
    return json({ success: false, state: result, message: '送信結果を確認できません。入力内容は残っています。お問い合わせから報告IDをお知らせください。', reportId: input.reportId }, 503)
  } catch { return json({ success: false, message: '送信結果を確認できません。入力内容を残したまま、もう一度送信結果をご確認ください。' }, 503) }
}
