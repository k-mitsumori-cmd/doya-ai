export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptToken, isGmailEnabled } from '@/lib/gmail/crypto'
import { emailFromIdToken, exchangeCode, getBaseUrl, GMAIL_SEND_SCOPE } from '@/lib/gmail/oauth'

export async function GET(req: NextRequest) {
  const back = (code: string) => {
    const res = NextResponse.redirect(`${getBaseUrl()}/settings/gmail?gmail=${code}`)
    res.cookies.delete({ name: 'gmail_oauth_state', path: '/api/gmail/callback' })
    return res
  }
  if (!isGmailEnabled()) return back('unconfigured')
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return back('unauthorized')

  const url = new URL(req.url)
  if (url.searchParams.get('error')) return back('denied')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookie = req.cookies.get('gmail_oauth_state')?.value
  if (!code || !state || cookie !== `${state}.${userId}`) return back('state')

  const { ok, data } = await exchangeCode(code)
  if (!ok || !data.refresh_token) return back('token')
  if (!(data.scope || '').split(' ').includes(GMAIL_SEND_SCOPE)) return back('scope')
  const email = emailFromIdToken(data.id_token) || session?.user?.email
  if (!email) return back('token')

  const enc = encryptToken(data.refresh_token)
  await prisma.gmailConnection.upsert({
    where: { userId },
    create: { userId, email, refreshTokenEnc: enc, scope: GMAIL_SEND_SCOPE },
    update: { email, refreshTokenEnc: enc, scope: GMAIL_SEND_SCOPE, status: 'ACTIVE', revokedAt: null, connectedAt: new Date() },
  })
  return back('connected')
}
