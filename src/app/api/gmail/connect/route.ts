export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomBytes } from 'crypto'
import { authOptions } from '@/lib/auth'
import { buildAuthUrl, getBaseUrl } from '@/lib/gmail/oauth'
import { isEncryptionConfigured } from '@/lib/gmail/crypto'

// 「Gmail と連携」ボタン → Google の同意画面へ（gmail.send のみを追加で同意）
export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return NextResponse.redirect(`${getBaseUrl()}/auth/signin?callbackUrl=/settings/gmail`)
  if (!isEncryptionConfigured() || !process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.redirect(`${getBaseUrl()}/settings/gmail?gmail=unconfigured`)
  }
  const state = randomBytes(24).toString('base64url')
  const res = NextResponse.redirect(buildAuthUrl(state, session?.user?.email))
  res.cookies.set('gmail_oauth_state', `${state}.${userId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/gmail/callback',
    maxAge: 600,
  })
  return res
}
