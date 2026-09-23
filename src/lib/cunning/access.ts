// ============================================
// ドヤカンニング 認証・アクセスヘルパー
// ============================================
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** ログインユーザーIDを取得（session.user.id 欠落時は email から補完）。未ログインは null */
export async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  let userId = (session?.user as any)?.id as string | undefined
  if (!userId && session?.user?.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    userId = dbUser?.id
  }
  if (!userId) return null
  // A signed session can outlive account deletion. Never authorize orphaned
  // Cunning records from the session ID alone.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  return user?.id || null
}
