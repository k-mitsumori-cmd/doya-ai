import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGuestIdFromRequest } from '@/lib/seoAccess'

/** User-owned articles cannot be accessed with an old guest cookie after account claim. */
export async function getSeoArticleOwner(req: NextRequest): Promise<{ userId: string } | { userId: null; guestId: string } | null> {
  const session = await getServerSession(authOptions)
  const userId = String((session?.user as any)?.id || '').trim()
  if (userId) return { userId }
  const guestId = getGuestIdFromRequest(req)
  return guestId ? { userId: null, guestId } : null
}

/** Legacy guest drafts remain readable, but provider-backed generation requires an account. */
export async function getSeoGenerationOwner(req: NextRequest): Promise<{ userId: string } | null> {
  const owner = await getSeoArticleOwner(req)
  return owner?.userId ? { userId: owner.userId } : null
}
