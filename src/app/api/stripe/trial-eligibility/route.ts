export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isTrialEligible } from '@/lib/trial'
import { privateApiJson } from '@/lib/private-api-response'

// GET /api/stripe/trial-eligibility
// 「初月無料」訴求の表示出し分け用。未ログイン訪問者は将来の新規顧客なので eligible:true。
// ログイン済みは Stripe 履歴で判定（再契約者は false）。
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const kinds = params.getAll('expectedKind')
  const actors = params.getAll('expectedActor')
  if (kinds.length !== 1 || !['guest', 'authenticated'].includes(kinds[0]) ||
      (kinds[0] === 'guest' ? actors.length !== 0 : actors.length !== 1 || !actors[0].trim() || actors[0] !== actors[0].trim())) {
    return privateApiJson({ code: 'INVALID_EXPECTED_PRINCIPAL' }, { status: 400 })
  }
  try {
    const session = await getServerSession(authOptions)
    if (session === null) {
      if (kinds[0] !== 'guest') return privateApiJson({ code: 'PRINCIPAL_CHANGED' }, { status: 409 })
      return privateApiJson({ version: 1, principal: { kind: 'guest' }, eligible: true })
    }
    const actualId = session.user?.id
    const email = session.user?.email
    if (typeof actualId !== 'string' || !actualId.trim() || typeof email !== 'string' || !email.trim()) {
      return privateApiJson({ code: 'SESSION_UNAVAILABLE' }, { status: 503 })
    }
    if (kinds[0] !== 'authenticated' || actors[0] !== actualId) return privateApiJson({ code: 'PRINCIPAL_CHANGED' }, { status: 409 })
    const user = await prisma.user.findUnique({
      where: { id: actualId },
      select: { id: true, email: true, stripeCustomerId: true },
    })
    if (!user || user.id !== actualId || !user.email || user.email.toLowerCase() !== email.toLowerCase()) {
      return privateApiJson({ code: 'USER_UNAVAILABLE' }, { status: 503 })
    }
    const eligible = await isTrialEligible({ email: user.email, stripeCustomerId: user.stripeCustomerId })
    return privateApiJson({ version: 1, principal: { kind: 'authenticated', actorId: actualId }, eligible })
  } catch {
    return privateApiJson({ code: 'TRIAL_CHECK_UNAVAILABLE' }, { status: 503 })
  }
}
