// サポートチャットの API で、ログインしている人の userId を引く（session に id が無ければメールから引く）
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function supportUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions).catch(() => null)
  const id = (session?.user as { id?: string } | undefined)?.id
  if (id) return id
  const email = session?.user?.email
  if (!email) return null
  return (await prisma.user.findUnique({ where: { email }, select: { id: true } }).catch(() => null))?.id ?? null
}
