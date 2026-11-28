export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/gmail/crypto'
import { revokeToken } from '@/lib/gmail/oauth'

// 連携の解除: Google 側で取り消し（revoke）し、保存したトークンを削除する
export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const conn = await prisma.gmailConnection.findUnique({ where: { userId } })
  if (!conn) return NextResponse.json({ success: true })
  let revoked = false
  try {
    revoked = await revokeToken(decryptToken(conn.refreshTokenEnc))
  } catch {}
  await prisma.gmailConnection.delete({ where: { userId } })
  return NextResponse.json({ success: true, revoked })
}
