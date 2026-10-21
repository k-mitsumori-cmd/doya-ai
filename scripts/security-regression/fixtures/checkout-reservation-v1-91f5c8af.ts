import { createHash, randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

// Stripe permits a Checkout lifetime of 30 minutes to 24 hours. Keep the
// reservation slightly longer than the session so an uncertain create result
// cannot open a second, simultaneously payable Checkout.
const SESSION_SECONDS = 40 * 60
const CREATE_LEASE_MS = 5 * 60_000
const RETRY_WINDOW_MS = 10 * 60_000
const EXPIRY_GRACE_MS = 2 * 60_000

type Creating = {
  phase: 'creating'; signature: string; idempotencyKey: string
  createdAt: number; leaseUntil: number; expiresAt: number
}
type Ready = {
  phase: 'ready'; signature: string; sessionId: string
  url: string; expiresAt: number
}
type Reservation = Creating | Ready

export class CheckoutReservationError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message)
  }
}

function parseReservation(value: string): Reservation {
  const state: unknown = JSON.parse(value)
  if (!state || typeof state !== 'object') throw new Error('Checkout reservation is invalid')
  const row = state as Record<string, unknown>
  if (row.phase === 'creating' && typeof row.signature === 'string' &&
    typeof row.idempotencyKey === 'string' && Number.isSafeInteger(row.createdAt) &&
    Number.isSafeInteger(row.leaseUntil) && Number.isSafeInteger(row.expiresAt)) return row as Creating
  if (row.phase === 'ready' && typeof row.signature === 'string' &&
    typeof row.sessionId === 'string' && typeof row.url === 'string' &&
    Number.isSafeInteger(row.expiresAt)) return row as Ready
  throw new Error('Checkout reservation is invalid')
}

const pending = () => new CheckoutReservationError(
  'CHECKOUT_IN_PROGRESS', 409,
  '決済画面がすでに開かれています。二重のお申し込みを防ぐため、新しい決済画面は作成していません。少し待ってから再度お試しください。',
)
const completed = () => new CheckoutReservationError(
  'CHECKOUT_ALREADY_COMPLETED', 409,
  '直前のお申し込みを確認中です。二重のお申し込みを防ぐため、新しい決済画面は作成していません。画面を再読み込みしてください。',
)

/** Both checkout entry points must use this same per-user key. */
export async function createReservedCheckoutSession<T extends { id: string; url: string | null; expires_at?: number }>(
  options: {
    userId: string
    signatureParts: unknown
    create: (idempotencyKey: string, expiresAt: number) => Promise<T>
  },
  db: Pick<PrismaClient, 'systemSetting'> = prisma,
  retrieve: typeof stripe.checkout.sessions.retrieve = stripe.checkout.sessions.retrieve.bind(stripe.checkout.sessions),
): Promise<{ id: string; url: string }> {
  const mode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test'
  const key = `checkout-reservation:v1:${mode}:${options.userId}`
  const signature = createHash('sha256').update(JSON.stringify(options.signatureParts)).digest('hex')

  for (let attempt = 0; attempt < 8; attempt++) {
    const now = Date.now()
    const row = await db.systemSetting.findUnique({ where: { key }, select: { value: true } })
    if (row) {
      const state = parseReservation(row.value)
      if (state.phase === 'ready') {
        // Even if the local subscription has not synced yet, a completed
        // Checkout must never be followed by a fresh session.
        const remote = await retrieve(state.sessionId)
        if (remote.status === 'complete') throw completed()
        if (remote.status === 'open') {
          if (state.signature === signature && remote.url) return { id: remote.id, url: remote.url }
          throw pending()
        }
        if (remote.status !== 'expired') throw pending()
      } else if (now < state.expiresAt * 1000 + EXPIRY_GRACE_MS) {
        if (now < state.leaseUntil || now > state.createdAt + RETRY_WINDOW_MS || state.signature !== signature) throw pending()
        // The first request may have reached Stripe before its response was
        // lost. Retry the *same* parameters and persisted idempotency key.
        const renewed: Creating = { ...state, leaseUntil: now + CREATE_LEASE_MS }
        const value = JSON.stringify(renewed)
        const claimed = await db.systemSetting.updateMany({ where: { key, value: row.value }, data: { value } })
        if (claimed.count !== 1) continue
        return finish(renewed, value, key, options.create, db)
      }
    }

    const state: Creating = {
      phase: 'creating', signature, idempotencyKey: randomUUID(),
      createdAt: now, leaseUntil: now + CREATE_LEASE_MS,
      expiresAt: Math.floor(now / 1000) + SESSION_SECONDS,
    }
    const value = JSON.stringify(state)
    if (row) {
      const claimed = await db.systemSetting.updateMany({ where: { key, value: row.value }, data: { value } })
      if (claimed.count !== 1) continue
    } else {
      try {
        await db.systemSetting.create({ data: { key, value } })
      } catch (error: any) {
        if (error?.code === 'P2002') continue
        throw error
      }
    }
    return finish(state, value, key, options.create, db)
  }
  throw new Error('Checkout reservation contention did not settle')
}

async function finish<T extends { id: string; url: string | null; expires_at?: number }>(
  state: Creating, value: string, key: string,
  create: (idempotencyKey: string, expiresAt: number) => Promise<T>,
  db: Pick<PrismaClient, 'systemSetting'>,
): Promise<{ id: string; url: string }> {
  const session = await create(state.idempotencyKey, state.expiresAt)
  if (!session.url) throw new Error('Stripe Checkout URL is missing')
  const ready: Ready = {
    phase: 'ready', signature: state.signature, sessionId: session.id,
    url: session.url, expiresAt: session.expires_at || state.expiresAt,
  }
  const saved = await db.systemSetting.updateMany({
    where: { key, value }, data: { value: JSON.stringify(ready) },
  })
  if (saved.count !== 1) throw new Error('Checkout reservation receipt could not be saved')
  return { id: session.id, url: session.url }
}
