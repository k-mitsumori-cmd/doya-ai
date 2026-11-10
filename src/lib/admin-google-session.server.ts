import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { isAdminGoogleEmail } from './admin-google-policy'

/** Resolve the existing authenticated app session; never trust a request header
 * or a client-supplied email. authOptions currently has only Google configured. */
export async function hasAdminGoogleSession(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions)
    return isAdminGoogleEmail(session?.user?.email)
  } catch {
    return false
  }
}
