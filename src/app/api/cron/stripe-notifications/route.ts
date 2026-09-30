import { NextRequest, NextResponse } from 'next/server'
import { deliverPendingStripeWebhookNotifications } from '@/lib/stripe-webhook-notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await deliverPendingStripeWebhookNotifications()
    return NextResponse.json(result, { status: result.failed > 0 ? 503 : 200 })
  } catch (error) {
    console.error('[Stripe webhook notification] cron failed:', error)
    return NextResponse.json({ error: 'Notification retry failed' }, { status: 500 })
  }
}
