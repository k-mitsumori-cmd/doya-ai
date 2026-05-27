import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getOrCreateWorkspace } from '@/lib/promane/auth'

export default async function PromanePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const userId = (session.user as any).id
  const workspace = await getOrCreateWorkspace(userId)
  redirect(`/promane/${workspace.slug}`)
}
