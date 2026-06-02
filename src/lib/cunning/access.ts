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
  return userId || null
}
