export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isNewPricingEnabledFor } from '@/lib/pricing-v2/rollout'
import { teamPriceConfig } from '@/lib/pricing-v2/prices'
import { readCheckoutRecovery, checkCheckoutRecovery } from '@/lib/pricing-v2/checkout-recovery.server'
import { TeamCheckoutSeatError } from '@/lib/pricing-v2/team-checkout-seat.server'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers })
async function owner(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const id = (session?.user as { id?: string } | undefined)?.id, email = session?.user?.email
  if (!id || !email) return { error: json({ code: 'LOGIN_REQUIRED', error: 'ログインし直してください。' }, 401) }
  if (!isNewPricingEnabledFor(email) || !teamPriceConfig().ok) return { error: json({ error: '見つかりません。' }, 404) }
  if (req.headers.get('x-doya-owner') !== id) return { error: json({ code: 'OWNER_CHANGED', error: 'ログイン情報が変わりました。ページを読み込み直してください。' }, 403) }
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, stripeCustomerId: true } })
  if (!user?.email || user.email.trim().toLowerCase() !== email.trim().toLowerCase()) return { error: json({ code: 'CHECKOUT_IDENTITY_CHANGED', error: 'ログイン情報が変わりました。再ログインしてください。' }, 403) }
  return { user: { ...user, email: user.email } }
}
function failure(error: unknown) {
  if (error instanceof TeamCheckoutSeatError) {
    const message = error.code === 'BELOW_USED'
      ? '決済画面の人数が現在のご利用人数より少ないため、再開できません。お問い合わせください。'
      : '契約や決済画面の状態が変わりました。もう一度状況をご確認ください。'
    return json({ code: error.code, error: message }, error.code === 'SEAT_CAPACITY_UNAVAILABLE' ? 503 : 409)
  }
  console.error('[pricing/checkout-recovery] could not verify current checkout')
  return json({ code: 'CHECKOUT_RECOVERY_UNAVAILABLE', error: '決済状況を確認できませんでした。新しい申し込みを作らず、もう一度状況をご確認ください。' }, 503)
}
export async function GET(req: NextRequest) {
  try {
    const c = await owner(req)
    if ('error' in c) return c.error
    return json(await readCheckoutRecovery(c.user.id))
  } catch (error) { return failure(error) }
}
async function smallBody(req: NextRequest): Promise<unknown> {
  if (!req.body) throw new Error('Invalid request body')
  const reader = req.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > 4096) throw new Error('Request too large')
      chunks.push(part.value)
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}
export async function POST(req: NextRequest) {
  try {
    const c = await owner(req)
    if ('error' in c) return c.error
    const expectedOrigin = new URL(req.url).origin
    if (req.headers.get('origin') !== expectedOrigin || req.headers.get('sec-fetch-site') === 'cross-site') return json({ code: 'INVALID_ORIGIN', error: '料金ページから状況をご確認ください。' }, 403)
    if (req.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') return json({ code: 'INVALID_ACTION', error: '操作を確認できませんでした。' }, 400)
    let body: unknown
    try { body = await smallBody(req) } catch { return json({ code: 'INVALID_ACTION', error: '操作を確認できませんでした。' }, 400) }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || (body as Record<string, unknown>).action !== 'check') return json({ code: 'INVALID_ACTION', error: '操作を確認できませんでした。' }, 400)
    return json(await checkCheckoutRecovery(c.user))
  } catch (error) { return failure(error) }
}
