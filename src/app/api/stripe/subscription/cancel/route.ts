import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LifecycleError } from '@/lib/account-lifecycle/state'
import { parseSubscriptionHttpAction, runSubscriptionHttpAction } from '@/lib/account-lifecycle/subscription-http'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body: unknown = await request.json()
    const action = parseSubscriptionHttpAction(body, 'cancel')
    return NextResponse.json(await runSubscriptionHttpAction('cancel', action, session), { headers })
  } catch (error) {
    const known = error instanceof LifecycleError ? error : null
    return NextResponse.json({ code: known?.code ?? 'SUBSCRIPTION_RESULT_UNKNOWN', error: known?.message ?? '解約結果を確認できませんでした。保存済みの操作で状態をご確認ください。' },
      { status: known?.status ?? 500, headers })
  }
}
